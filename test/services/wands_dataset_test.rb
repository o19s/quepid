# frozen_string_literal: true

require 'test_helper'

class WandsDatasetTest < ActiveSupport::TestCase
  let(:user) { users(:random) }
  let(:kase) { Case.create!(case_name: 'WANDS', owner: user) }

  setup do
    @directory = Pathname.new(Dir.mktmpdir('wands'))
    WandsData.directory = @directory
    WandsData::FILES.each_value do |file, _|
      stub_request(:get, "#{WandsData::BASE_URL}/#{file}").to_return(status: 200, body: File.read(Rails.root.join('test/fixtures/files/wands', file)))
    end
  end

  teardown do
    WandsData.directory = nil
    FileUtils.rm_rf(@directory)
  end

  def ratings_of kase
    kase.queries.order(:arranged_at).to_h { |query| [ query.query_text, query.ratings.order(:doc_id).pluck(:doc_id, :rating) ] }
  end

  test 'makes the queries, in the order of the file, with their ratings on the scale of the labels' do
    WandsDataset.new(user).populate(kase)

    assert_equal [ 'salon chair', 'smart coffee table', 'dinosaur' ], kase.queries.order(:arranged_at).pluck(:query_text)
    assert_equal [ [ '0', 2.0 ], [ '1', 0.0 ], [ '2', 1.0 ] ], ratings_of(kase)['salon chair']
  end

  test 'keeps one rating per query and product: the commonest label, and the higher one when two tie' do
    WandsDataset.new(user).populate(kase)

    ratings = ratings_of(kase)

    assert_equal [ [ '0', 1.0 ], [ '1', 1.0 ], [ '2', 2.0 ] ], ratings['smart coffee table'] # Partial twice; Partial x2 + Exact; Exact + Partial
    assert_equal 1, kase.queries.joins(:ratings).where(query_text: 'smart coffee table', ratings: { doc_id: '0' }).count
  end

  test 'leaves out a label it does not know and a query that is not in the file' do
    WandsDataset.new(user).populate(kase)

    assert_equal [ [ '2', 2.0 ] ], ratings_of(kase)['dinosaur'], 'the Weird label for product 3 is dropped'
    assert_equal 7, Rating.joins(:query).where(queries: { case_id: kase.id }).count, '3 + 3 + 1 distinct pairs'
    assert_not Rating.joins(:query).exists?(queries: { case_id: kase.id }, ratings: { doc_id: '99' })
  end

  test 'the ratings belong to nobody, since they come from the dataset' do
    WandsDataset.new(user).populate(kase)

    assert_equal [ nil ], Rating.joins(:query).where(queries: { case_id: kase.id }).distinct.pluck(:user_id)
  end

  test 'loads a sample of the queries, with only their ratings, in the order of the file' do
    WandsDataset.new(user).populate(kase, sample: 2)

    queries = kase.queries.order(:arranged_at).pluck(:query_text)

    assert_equal 2, queries.size
    assert_equal(queries, [ 'salon chair', 'smart coffee table', 'dinosaur' ].select { |text| queries.include?(text) })
    assert_equal queries, ratings_of(kase).keys
    assert_equal Rating.joins(:query).where(queries: { case_id: kase.id }).count, ratings_of(kase).values.sum(&:size)
  end

  test 'needs only the queries and labels, not the big product file' do
    WandsDataset.new(user).populate(kase)

    assert_not_requested :get, "#{WandsData::BASE_URL}/product.csv"
    assert_predicate WandsData.path(:query), :exist?
    assert_predicate WandsData.path(:label), :exist?
    assert_not_predicate WandsData.path(:product), :exist?
  end

  test 'passes a download problem on, and leaves the case empty' do
    stub_request(:get, "#{WandsData::BASE_URL}/label.csv").to_return(status: 503, body: 'down')

    assert_raises(WandsData::Error) { WandsDataset.new(user).populate(kase) }
    assert_equal 0, kase.queries.count
  end

  test 'uses the same three labels as the catalog, on a scale a scorer can be made for' do
    entry = DatasetCatalog.find('wands')

    assert_equal WandsDataset::RATINGS.invert.transform_keys(&:to_s), entry.scale_labels
    assert_equal [ 0, 1, 2 ], entry.scale
  end
end
