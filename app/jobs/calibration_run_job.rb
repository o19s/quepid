# frozen_string_literal: true

# Has a calibration run's AI judge rate every pair in its sample it hasn't
# answered yet (docs/todo/judge_calibration.md C5). Each pair goes through the
# same LlmService call and JudgementFinalizer a judging run uses, so the
# judge sees exactly what it would in real judging -- but the result is kept
# as a CalibrationAnswer and the judgement is never saved: nothing here
# touches ratings, case scores or the judging queue.
#
# Cancelling sets the run's status; the loop checks it before every pair.
# Resuming enqueues the job again, and it picks up the pairs still unanswered.
class CalibrationRunJob < ApplicationJob
  queue_as :default

  limits_concurrency to:          1,
                     key:         ->(run) { "calibration_run_#{run.id}" },
                     on_conflict: :discard

  def perform run
    return unless run.reload.active?

    run.update!(status: 'running', started_at: run.started_at || Time.current, error: nil)
    broadcast(run)

    # The run's own settings, which a tuning run may have changed from the judge's.
    judge = run.tuned_judge
    llm_service = LlmService.new(judge.llm_key, judge.judge_options)
    scale = JudgeScale.for(run.book)

    cancelled = false
    run.pending_pairs.order(:id).each do |query_doc_pair|
      cancelled = run.reload.cancelled?
      break if cancelled

      answer(run, judge, llm_service, scale, query_doc_pair)
      broadcast(run)
    end

    finish(run) unless cancelled
  rescue StandardError => e
    run.update!(status: 'failed', error: e.message, finished_at: Time.current)
    broadcast(run)
    raise
  end

  private

  def answer run, judge, llm_service, scale, query_doc_pair
    judgement = Judgement.new(query_doc_pair: query_doc_pair, user: judge)
    llm_service.perform_safe_judgement(judgement, scale: scale)
    JudgementFinalizer.call(judgement, scale: scale)
    run.answers.create!(query_doc_pair: query_doc_pair, rating: judgement.rating,
                        unrateable: judgement.unrateable, explanation: judgement.explanation)
  end

  # A run where most calls failed reports the failure, not an agreement
  # figure over the few that worked.
  def finish run
    errored = run.answers.errored
    if errored.count * 2 > run.sample.size
      run.update!(status: 'failed', error: errored.first.explanation, finished_at: Time.current)
    else
      run.update!(status: 'done', finished_at: Time.current)
    end
    broadcast(run)
  end

  # The run's row on the calibrations list, and its own page's progress.
  def broadcast run
    Turbo::StreamsChannel.broadcast_replace_to(
      run.broadcast_channel,
      target:  "calibration-run-#{run.id}",
      partial: 'calibrations/run_row',
      locals:  { run: run }
    )
    Turbo::StreamsChannel.broadcast_replace_to(
      run.broadcast_channel,
      target:  "calibration-progress-#{run.id}",
      partial: 'calibrations/progress',
      locals:  { run: run }
    )
    return if run.active?

    # The results appear once the run stops. Not a page refresh: Turbo
    # refreshes the <base href>, which on Quepid's pages is the root.
    Turbo::StreamsChannel.broadcast_replace_to(
      run.broadcast_channel,
      target:  "calibration-results-#{run.id}",
      partial: 'calibrations/results',
      locals:  { run: run }
    )
  end
end
