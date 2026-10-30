# frozen_string_literal: true

require 'test_helper'

class DatasetDocumentsTest < ActiveSupport::TestCase
  let(:user) { users(:random) }
  let(:haystack) { DatasetCatalog.find('haystack') }
  let(:book) { Book.create!(name: 'Docs', owner: user, scale: [ 0, 1 ]) }
  let(:kase) { Case.create!(case_name: 'Haystack', owner: user, book: book) }

  def pair query, doc_id, fields
    QueryDocPair.create!(book: book, query_text: query, doc_id: doc_id, document_fields: fields)
  end

  test 'has no documents for a case without a book, or whose book has none with fields' do
    assert_not DatasetDocuments.available?(haystack, Case.create!(case_name: 'No book', owner: user))
    pair('q', 'd1', nil)

    assert_not DatasetDocuments.available?(haystack, kase)
    assert_equal 0, DatasetDocuments.count(haystack, kase)
    assert_empty DatasetDocuments.canonical(haystack, kase)
  end

  test 'has no documents for a dataset whose documents are not in Quepid' do
    pair('q', 'd1', { 'title' => 'T' }.to_json)

    assert_not DatasetDocuments.available?(DatasetCatalog.find('imdb'), kase)
    assert_empty DatasetDocuments.canonical(DatasetCatalog.find('imdb'), kase)
  end

  test 'makes each document once, in the canonical shape, whichever query it was rated for' do
    pair('first query', 'd1', { 'name' => 'ProScreen', 'brand' => 'Projecta', 'product_type' => 'Screen', 'junk' => 'x' }.to_json)
    pair('second query', 'd1', { 'name' => 'ProScreen', 'brand' => 'Projecta' }.to_json)
    pair('second query', 'd2', { 'title' => 'Other', 'thumb' => 'http://x/y.jpg' }.to_json)

    assert_equal 2, DatasetDocuments.count(haystack, kase)
    assert_equal [ { 'id' => 'd1', 'title' => 'ProScreen', 'brand' => 'Projecta', 'category' => [ 'Screen' ] },
                   { 'id' => 'd2', 'title' => 'Other', 'thumb' => 'http://x/y.jpg' } ], DatasetDocuments.canonical(haystack, kase)
  end

  test 'leaves out a pair with no fields, and uses the same document from another pair that has them' do
    pair('q1', 'd1', {}.to_json)
    pair('q1', 'd2', { 'title' => 'Fine' }.to_json)
    pair('q2', 'd1', { 'title' => 'Second try' }.to_json)

    assert_equal %w[d2 d1], DatasetDocuments.canonical(haystack, kase).pluck('id')
    assert_equal 2, DatasetDocuments.count(haystack, kase)
  end
end
