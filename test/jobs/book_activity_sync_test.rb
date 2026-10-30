# frozen_string_literal: true

require 'test_helper'

class BookActivitySyncTest < ActiveJob::TestCase
  let(:book) { books(:james_bond_movies) }
  let(:judge) { users(:judge_judy) }

  test 'failed judging jobs are not reported as actively judging' do
    job = SolidQueue::Job.create!(class_name: 'RunJudgeJudyJob', queue_name: 'default',
                                  arguments: { 'arguments' => [ { '_aj_globalid' => book.to_global_id.to_s },
                                                                { '_aj_globalid' => judge.to_global_id.to_s }, nil ] })
    job.failed_with(RuntimeError.new('provider failed'))
    assert_empty RunJudgeJudyJob.active_for(book, judge)
    assert_empty RunJudgeJudyJob.actively_judging_user_ids(book)
  end

  test 'cancelling a claimed judging job holds its lock until the worker finishes' do
    key = "cancel-test-#{SecureRandom.uuid}"
    job = SolidQueue::Job.create!(class_name: 'RunJudgeJudyJob', queue_name: 'default', concurrency_key: key,
                                  arguments: { 'arguments' => [ { '_aj_globalid' => book.to_global_id.to_s },
                                                                { '_aj_globalid' => judge.to_global_id.to_s }, nil ] })
    process = SolidQueue::Process.create!(kind: 'Worker', name: key, pid: Process.pid,
                                          last_heartbeat_at: Time.current)
    claimed = SolidQueue::ClaimedExecution.create!(job: job, process: process)
    job.ready_execution.destroy!
    semaphore = SolidQueue::Semaphore.find_by!(key: key)
    assert_equal 0, semaphore.value

    RunJudgeJudyJob.cancel(book, judge)

    assert job.reload.arguments['quepid_cancelled']
    assert SolidQueue::ClaimedExecution.exists?(job_id: job.id)
    assert_equal 0, semaphore.reload.value

    claimed.send(:finished)
    assert_equal 1, semaphore.reload.value
    assert_empty RunJudgeJudyJob.active_for(book, judge)
  end

  test 'automatic continuation survives a bounded run and coalesces new pairs' do
    register_default_openai_stubs
    manual_adapter = RunJudgeJudyJob.queue_adapter
    auto_adapter = AutoRunJudgeJudyJob.queue_adapter
    RunJudgeJudyJob.queue_adapter = :solid_queue
    AutoRunJudgeJudyJob.queue_adapter = :solid_queue
    scoped_book = Book.create!(name: 'Queued automatic continuation', scale: [ 0, 1 ])
    scoped_book.query_doc_pairs.create!(query_text: 'Continuation', doc_id: 'first')
    scoped_book.books_ai_judges.create!(ai_judge: judge, auto_run: true)
    process = SolidQueue::Process.create!(kind: 'Worker', name: SecureRandom.uuid, pid: Process.pid,
                                          last_heartbeat_at: Time.current)
    manual = RunJudgeJudyJob.perform_later(scoped_book, judge, 1)
    manual_row = SolidQueue::Job.find_by!(active_job_id: manual.job_id)
    manual_claim = SolidQueue::ClaimedExecution.create!(job: manual_row, process: process)
    manual_row.ready_execution.destroy!

    2.times { |index| scoped_book.query_doc_pairs.create!(query_text: 'Continuation', doc_id: "new-#{index}") }
    auto_rows = AutoRunJudgeJudyJob.active_for(scoped_book, judge).select { |row| 'AutoRunJudgeJudyJob' == row.class_name }
    assert_equal 1, auto_rows.size
    assert_predicate auto_rows.first, :blocked?
    assert_includes RunJudgeJudyJob.actively_judging_user_ids(scoped_book), judge.id

    # Conflicting manual launches still discard rather than silently queue.
    conflicting = RunJudgeJudyJob.perform_later(scoped_book, judge, 10)
    assert_not SolidQueue::Job.exists?(active_job_id: conflicting.job_id)
    manual_claim.perform
    assert_equal 1, scoped_book.judgements.where(user: judge).count

    auto_row = auto_rows.first.reload
    assert_predicate auto_row, :ready?
    auto_claim = SolidQueue::ClaimedExecution.create!(job: auto_row, process: process)
    auto_row.ready_execution.destroy!
    # A running automatic job must also retain a continuation at its tail.
    scoped_book.query_doc_pairs.create!(query_text: 'Continuation', doc_id: 'last')
    auto_claim.perform
    assert_equal 4, scoped_book.judgements.where(user: judge).count
    continuation = AutoRunJudgeJudyJob.active_for(scoped_book, judge).sole
    assert_predicate continuation, :ready?
    continuation_claim = SolidQueue::ClaimedExecution.create!(job: continuation, process: process)
    continuation.ready_execution.destroy!
    continuation_claim.perform
    assert_requested :post, 'https://api.openai.com/v1/chat/completions', times: 4
    assert_empty RunJudgeJudyJob.active_for(scoped_book, judge)
  ensure
    RunJudgeJudyJob.queue_adapter = manual_adapter
    AutoRunJudgeJudyJob.queue_adapter = auto_adapter
  end

  test 'cancellation also stops a queued automatic continuation without provider requests' do
    manual_adapter = RunJudgeJudyJob.queue_adapter
    auto_adapter = AutoRunJudgeJudyJob.queue_adapter
    RunJudgeJudyJob.queue_adapter = :solid_queue
    AutoRunJudgeJudyJob.queue_adapter = :solid_queue
    process = SolidQueue::Process.create!(kind: 'Worker', name: SecureRandom.uuid, pid: Process.pid,
                                          last_heartbeat_at: Time.current)
    manual = RunJudgeJudyJob.perform_later(book, judge, 1)
    manual_row = SolidQueue::Job.find_by!(active_job_id: manual.job_id)
    manual_claim = SolidQueue::ClaimedExecution.create!(job: manual_row, process: process)
    manual_row.ready_execution.destroy!
    automatic = AutoRunJudgeJudyJob.perform_later(book, judge, nil)
    auto_row = SolidQueue::Job.find_by!(active_job_id: automatic.job_id)

    RunJudgeJudyJob.cancel(book, judge)
    assert manual_row.reload.arguments['quepid_cancelled']
    assert auto_row.reload.arguments['quepid_cancelled']
    assert_no_difference 'book.judgements.count' do
      manual_claim.perform
      auto_claim = SolidQueue::ClaimedExecution.create!(job: auto_row.reload, process: process)
      auto_row.ready_execution.destroy!
      auto_claim.perform
    end
    assert_not_requested :post, 'https://api.openai.com/v1/chat/completions'
    assert_empty RunJudgeJudyJob.active_for(book, judge)
  ensure
    RunJudgeJudyJob.queue_adapter = manual_adapter
    AutoRunJudgeJudyJob.queue_adapter = auto_adapter
  end

  test 'array-based forward sync jobs are detected only for their book and automatic cases' do
    kase = cases(:case_with_book)
    kase.update!(book: book, auto_populate_case_judgements: true)
    SolidQueue::Job.create!(class_name: 'UpdateCaseRatingsJob', queue_name: 'default',
                            arguments: { 'arguments' => [ [ book.query_doc_pairs.first.id ] ] })
    assert UpdateCaseRatingsJob.actively_syncing?(book, kase)
    assert_not UpdateCaseRatingsJob.actively_syncing?(books(:empty_book), kase)
    kase.update!(auto_populate_case_judgements: false)
    assert_not UpdateCaseRatingsJob.actively_syncing?(book, kase)
  end

  test 'array-based reverse sync jobs are detected only for the rating case' do
    rating = Rating.first
    SolidQueue::Job.create!(class_name: 'JudgementFromRatingJob', queue_name: 'default',
                            arguments: { 'arguments' => [ { '_aj_globalid' => users(:random).to_global_id.to_s }, [ rating.id ] ] })
    assert JudgementFromRatingJob.actively_populating?(rating.query.case.book, rating.query.case)
    assert_not JudgementFromRatingJob.actively_populating?(book, cases(:random_case))
  end

  test 'a missing judge globalid does not break book activity' do
    SolidQueue::Job.create!(class_name: 'RunJudgeJudyJob', queue_name: 'default',
                            arguments: { 'arguments' => [ { '_aj_globalid' => book.to_global_id.to_s },
                                                          { '_aj_globalid' => 'gid://quepid/AiJudge/999999999' }, nil ] })
    assert_empty RunJudgeJudyJob.actively_judging_user_ids(book)
  end
end
