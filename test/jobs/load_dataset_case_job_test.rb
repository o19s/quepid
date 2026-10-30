# frozen_string_literal: true

require 'test_helper'

class LoadDatasetCaseJobTest < ActiveJob::TestCase
  let(:user) { users(:random) }

  def pending_link dataset_key
    kase = Case.create!(case_name: 'Waiting', owner: user)
    CaseToDataset.create!(dataset: Dataset.for(user, dataset_key), case: kase)
  end

  test 'loads the dataset into the case and marks the link done' do
    link = pending_link('imdb')

    LoadDatasetCaseJob.perform_now(link, 'Waiting', nil)

    assert_equal 'done', link.reload.status
    assert_nil link.error
    assert_equal ImdbDataset::QUERIES, link.case.queries.order(:arranged_at).map(&:query_text)
  end

  test 'loads only a sample of the queries when asked to' do
    link = pending_link('imdb')

    LoadDatasetCaseJob.perform_now(link, 'Waiting', nil, 3)

    loaded = link.case.queries.order(:arranged_at).map(&:query_text)

    assert_equal 'done', link.reload.status
    assert_equal 3, loaded.size
    assert_equal loaded, ImdbDataset::QUERIES.select { |text| loaded.include?(text) }, 'in the dataset order'
  end

  test 'loads a sample of the Haystack queries, with only their ratings and book pairs' do
    Scorer.find_or_create_by!(name: 'nDCG@10') { |scorer| scorer.assign_attributes(scale: (0..3).to_a, communal: true, code: 'setScore(1);') }
    link = pending_link('haystack')

    LoadDatasetCaseJob.perform_now(link, 'Sample', nil, 5)

    kase = link.case.reload
    texts = kase.queries.map(&:query_text)

    assert_equal 'done', link.reload.status
    assert_equal 5, texts.size
    assert_equal texts.sort, kase.book.query_doc_pairs.distinct.pluck(:query_text).sort.select { |text| texts.include?(text) }.uniq.sort
    assert_empty kase.book.query_doc_pairs.pluck(:query_text) - texts
    assert_operator Rating.joins(:query).where(queries: { case_id: kase.id }).count, :<, 1679
  end

  test 'keeps the name and scorer the user picked over the ones in the dataset export' do
    Scorer.find_or_create_by!(name: 'nDCG@10') { |scorer| scorer.assign_attributes(scale: (0..3).to_a, communal: true, code: 'setScore(1);') }
    link = pending_link('haystack')
    picked = scorers(:'p@10')

    LoadDatasetCaseJob.perform_now(link, 'My party', picked)

    kase = link.case.reload

    assert_equal 'done', link.reload.status
    assert_equal 'My party', kase.case_name
    assert_equal picked, kase.scorer
    assert_equal 137, kase.queries.count
  end

  test 'records a problem with the data on the link without raising' do
    Scorer.where(name: 'nDCG@10').destroy_all # the Haystack export names this scorer
    link = pending_link('haystack')

    assert_nothing_raised { LoadDatasetCaseJob.perform_now(link, 'Waiting', nil) }

    assert_equal 'failed', link.reload.status
    assert_match(/nDCG@10/, link.error)
    assert_equal 0, link.case.queries.count
  end

  test 'records an unexpected error on the link and raises it' do
    link = pending_link('imdb')
    ImdbDataset.define_singleton_method(:new) { |*| raise 'boom' }
    begin
      assert_raises(RuntimeError) { LoadDatasetCaseJob.perform_now(link, 'Waiting', nil) }
    ensure
      ImdbDataset.singleton_class.remove_method(:new)
    end

    assert_equal 'failed', link.reload.status
    assert_equal 'boom', link.error
  end

  test 'runs on the bulk processing queue' do
    assert_equal 'bulk_processing', LoadDatasetCaseJob.new.queue_name
  end
end
