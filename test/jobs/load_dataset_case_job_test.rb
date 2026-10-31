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

  test 'a Haystack case keeps the search endpoint of its export, on purpose: the data is already indexed there' do
    Scorer.find_or_create_by!(name: 'nDCG@10') { |scorer| scorer.assign_attributes(scale: (0..3).to_a, communal: true, code: 'setScore(1);') }
    link = pending_link('haystack')

    assert_difference 'SearchEndpoint.count', 1 do
      LoadDatasetCaseJob.perform_now(link, 'Haystack', nil)
    end

    first_try = link.case.reload.tries.first

    assert_equal 'http://chorus.dev.o19s.com:8983/solr/ecommerce/select', first_try.search_endpoint.endpoint_url
    assert_equal 'solr', first_try.search_endpoint.search_engine
    assert_match(/useParams=querqy_match_by_txt_emb/, first_try.query_params)
    assert_equal user, first_try.search_endpoint.owner
  end

  test 'a Haystack case has the name the user gave it from the start, not only once the slow book import is done' do
    Scorer.find_or_create_by!(name: 'nDCG@10') { |scorer| scorer.assign_attributes(scale: (0..3).to_a, communal: true, code: 'setScore(1);') }
    link = pending_link('haystack')
    name_while_importing_the_book = nil
    original = HaystackDataset.instance_method(:import_book)
    HaystackDataset.send(:define_method, :import_book) do |*args|
      name_while_importing_the_book = link.case.reload.case_name
      original.bind_call(self, *args)
    end

    LoadDatasetCaseJob.perform_now(link, 'My own name', nil)

    assert_equal 'My own name', name_while_importing_the_book
    assert_equal 'My own name', link.case.reload.case_name
  ensure
    HaystackDataset.send(:define_method, :import_book, original) if original
  end

  test 'a second Haystack case reuses the endpoint the first one attached' do
    Scorer.find_or_create_by!(name: 'nDCG@10') { |scorer| scorer.assign_attributes(scale: (0..3).to_a, communal: true, code: 'setScore(1);') }
    first = pending_link('haystack')
    LoadDatasetCaseJob.perform_now(first, 'First', nil)
    second_case = Case.create!(case_name: 'Second', owner: user)
    second = CaseToDataset.create!(dataset: Dataset.for(user, 'haystack'), case: second_case)

    assert_no_difference 'SearchEndpoint.count' do
      LoadDatasetCaseJob.perform_now(second, 'Second', nil)
    end

    assert_equal first.case.reload.tries.first.search_endpoint, second_case.reload.tries.first.search_endpoint
  end

  def with_wands_files
    directory = Pathname.new(Dir.mktmpdir('wands'))
    WandsData.directory = directory
    WandsData::FILES.each_value do |file, _|
      stub_request(:get, "#{WandsData::BASE_URL}/#{file}").to_return(status: 200, body: File.read(Rails.root.join('test/fixtures/files/wands', file)))
    end
    yield
  ensure
    WandsData.directory = nil
    FileUtils.rm_rf(directory) if directory
  end

  test 'loads the WANDS queries and ratings into the case' do
    link = pending_link('wands')

    with_wands_files { LoadDatasetCaseJob.perform_now(link, 'WANDS', nil) }

    assert_equal 'done', link.reload.status
    assert_equal [ 'salon chair', 'smart coffee table', 'dinosaur' ], link.case.queries.order(:arranged_at).pluck(:query_text)
    assert_equal 7, Rating.joins(:query).where(queries: { case_id: link.case.id }).count
    assert_nil link.case.tries.first.search_endpoint, 'WANDS has no search engine of its own: the user picks one'
  end

  test 'loads a sample of the WANDS queries' do
    link = pending_link('wands')

    with_wands_files { LoadDatasetCaseJob.perform_now(link, 'WANDS', nil, 1) }

    assert_equal 'done', link.reload.status
    assert_equal 1, link.case.queries.count
  end

  test 'a retry after a failed run loads the dataset once, not on top of what that run left' do
    link = pending_link('wands')
    failing = WandsDataset.instance_method(:insert_ratings)
    WandsDataset.define_method(:insert_ratings) { |_ids| raise ActiveRecord::StatementInvalid, 'the database went away' }

    with_wands_files do
      assert_raises(ActiveRecord::StatementInvalid) { LoadDatasetCaseJob.perform_now(link, 'WANDS', nil) }

      assert_equal 'failed', link.reload.status
      assert_equal 3, link.case.queries.count, 'the failed run left its queries'

      WandsDataset.define_method(:insert_ratings, failing)
      LoadDatasetCaseJob.perform_now(link, 'WANDS', nil)
    end

    assert_equal 'done', link.reload.status
    assert_equal [ 'salon chair', 'smart coffee table', 'dinosaur' ], link.case.queries.order(:arranged_at).pluck(:query_text)
    assert_equal 7, Rating.joins(:query).where(queries: { case_id: link.case.id }).count
  ensure
    WandsDataset.define_method(:insert_ratings, failing) if failing
  end

  test 'records a WANDS download that failed on the link, without raising, and leaves the case empty' do
    link = pending_link('wands')
    directory = Pathname.new(Dir.mktmpdir('wands'))
    WandsData.directory = directory
    stub_request(:get, "#{WandsData::BASE_URL}/query.csv").to_return(status: 503, body: 'down')

    assert_nothing_raised { LoadDatasetCaseJob.perform_now(link, 'WANDS', nil) }

    assert_equal 'failed', link.reload.status
    assert_match(/GitHub answered 503/, link.error)
    assert_equal 0, link.case.queries.count
  ensure
    WandsData.directory = nil
    FileUtils.rm_rf(directory) if directory
  end
end
