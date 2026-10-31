# frozen_string_literal: true

require 'test_helper'

class HomeDepotDatasetTest < ActiveJob::TestCase
  let(:user) { users(:random) }
  let(:entry) { DatasetCatalog.find('home_depot') }

  def pending_link
    kase = Case.create!(case_name: 'Home Depot', owner: user)
    CaseToDataset.create!(dataset: Dataset.for(user, 'home_depot'), case: kase)
  end

  def ratings_of kase
    kase.queries.order(:arranged_at).to_h { |query| [ query.query_text, query.ratings.order(:doc_id).pluck(:doc_id, :rating) ] }
  end

  test 'makes the search terms queries, in the order of the file, with the scores rounded to 0, 1 and 2' do
    link = pending_link

    with_home_depot_upload(home_depot_zip) { LoadDatasetCaseJob.perform_now(link, 'Home Depot', nil) }

    assert_equal 'done', link.reload.status
    assert_equal({ 'angle bracket' => [ [ '100001', 2.0 ], [ '100002', 0.0 ] ], 'l bracket' => [ [ '100001', 2.0 ] ],
                   'shower faucet' => [ [ '100003', 1.0 ] ], 'deck over' => [ [ '100002', 1.0 ] ] }, ratings_of(link.case))
  end

  test 'keeps the rated products in a book that goes with the case, which is where their documents are indexed from' do
    link = pending_link

    with_home_depot_upload(home_depot_zip) { LoadDatasetCaseJob.perform_now(link, 'Home Depot', nil) }

    book = link.case.reload.book

    assert_equal 'Home Depot', book.name
    assert_equal user, book.owner
    assert_equal [ [ 'angle bracket', '100001' ], [ 'angle bracket', '100002' ], [ 'deck over', '100002' ], [ 'l bracket', '100001' ],
                   [ 'shower faucet', '100003' ] ], book.query_doc_pairs.order(:query_text, :doc_id).pluck(:query_text, :doc_id)

    documents = DatasetDocuments.canonical(entry, link.case).index_by { |doc| doc['id'] }

    assert_equal %w[100001 100002 100003], documents.keys.sort, 'each rated product once; 100099 was rated by nobody'
    assert_equal({ 'id' => '100001', 'title' => 'Simpson Strong-Tie 12-Gauge Angle', 'description' => 'Not only do angles make joints stronger',
                   'brand' => 'Simpson Strong-Tie' }, documents['100001'].slice('id', 'title', 'description', 'brand'))
    assert_equal 'Delta 90° Shower Faucet', documents['100003']['title']
    assert_nil documents['100003']['brand'], 'it has no brand in attributes.csv'
    assert_equal 3, DatasetDocuments.count(entry, link.case)
  end

  test 'deletes the uploaded files once the case is made' do
    link = pending_link

    with_home_depot_upload(home_depot_zip) do |directory|
      LoadDatasetCaseJob.perform_now(link, 'Home Depot', nil)

      assert_not HomeDepotData.uploaded?
      assert_empty Dir.children(directory).grep(/\.csv\z/)
    end
  end

  test 'loads a sample of the search terms, with only their ratings and products' do
    link = pending_link

    with_home_depot_upload(home_depot_zip) { LoadDatasetCaseJob.perform_now(link, 'Home Depot', nil, 2) }

    terms = link.case.queries.order(:arranged_at).pluck(:query_text)

    assert_equal 2, terms.size
    assert_equal terms, [ 'angle bracket', 'l bracket', 'shower faucet', 'deck over' ].select { |term| terms.include?(term) }, 'in the file order'
    assert_equal terms.sort, link.case.book.query_doc_pairs.distinct.pluck(:query_text).sort
  end

  test 'says on the link to upload the files again when they are not there, and keeps the case empty' do
    link = pending_link

    with_home_depot_upload { assert_nothing_raised { LoadDatasetCaseJob.perform_now(link, 'Home Depot', nil) } }

    assert_equal 'failed', link.reload.status
    assert_match(/upload them again/, link.error)
    assert_equal 0, link.case.queries.count
    assert_nil link.case.book
  end

  test 'keeps the files when the import fails, so it can be tried again' do
    link = pending_link
    Book.define_singleton_method(:create!) { |*| raise ActiveRecord::RecordInvalid }

    with_home_depot_upload(home_depot_zip) do
      LoadDatasetCaseJob.perform_now(link, 'Home Depot', nil)

      assert_equal 'failed', link.reload.status
      assert_predicate HomeDepotData, :uploaded?
      assert_equal 0, link.case.queries.count, 'nothing of the failed import is left'
    end
  ensure
    Book.singleton_class.remove_method(:create!)
  end
end
