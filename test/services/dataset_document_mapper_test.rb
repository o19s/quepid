# frozen_string_literal: true

require 'test_helper'

class DatasetDocumentMapperTest < ActiveSupport::TestCase
  # A mapper that uses every helper.
  let(:mapper) do
    Class.new(DatasetDocumentMapper) do
      null_values 'N/A'

      title first_of(:headline, :name)
      description join(:summary, :details, with: ' - ')
      brand from(:maker)
      price number(:cost)
      category split(:tags, ';')
      rating compute('twice the stars', uses: [ :stars ]) { |doc| doc['stars'].to_f * 2 if doc['stars'] }
    end
  end

  test 'fills in each canonical field from where the rule says' do
    doc = mapper.map({ 'headline' => ' A Title ', 'summary' => 'Short', 'details' => 'Long', 'maker' => 'Acme', 'cost' => '12.50',
                       'tags' => 'a;b', 'stars' => '2' }, id: 'x1')

    assert_equal({ 'id' => 'x1', 'title' => 'A Title', 'description' => 'Short - Long', 'brand' => 'Acme', 'price' => 12.5,
                   'category' => %w[a b], 'rating' => 4.0 }, doc)
  end

  test 'first_of skips blanks and uses the next field' do
    assert_equal 'Second', mapper.map({ 'headline' => '  ', 'name' => 'Second' }, id: '1')['title']
  end

  test 'leaves out a field with no value, a blank, or a null marker' do
    doc = mapper.map({ 'headline' => 'T', 'maker' => 'N/A', 'cost' => 'cheap', 'tags' => '' }, id: '1')

    assert_equal({ 'id' => '1', 'title' => 'T' }, doc)
  end

  test 'drops source fields that no rule uses, and does not invent an attributes field' do
    doc = mapper.map({ 'headline' => 'T', 'unrelated' => 'x', 'other' => { 'a' => 1 } }, id: '1')

    assert_equal %w[id title], doc.keys
  end

  test 'a list field is always a list of distinct values, and a number field a number' do
    doc = mapper.map({ 'tags' => 'a;b;a; ;c', 'cost' => 3 }, id: '1')

    assert_equal %w[a b c], doc['category']
    assert_in_delta(3.0, doc['price'])
  end

  test 'accepts symbol keys, and makes the id text' do
    assert_equal({ 'id' => '7', 'title' => 'T' }, mapper.map({ headline: 'T' }, id: 7))
  end

  test 'describes where each field comes from, in the schema order' do
    assert_equal %w[title description brand price rating category], mapper.describe.map(&:first)
    assert_equal 'the first of `headline`, `name` that has a value', mapper.describe.to_h['title']
    assert_equal '`summary` and `details`, joined with " - "', mapper.describe.to_h['description']
    assert_equal '`cost` as a number', mapper.describe.to_h['price']
    assert_equal '`tags` split on ";"', mapper.describe.to_h['category']
  end

  test 'one mapper does not leak its rules into another' do
    other = Class.new(DatasetDocumentMapper) { brand from(:maker) }

    assert_equal [ 'brand' ], other.describe.map(&:first)
    assert_not_equal mapper.rules.keys, other.rules.keys
  end

  test 'the Haystack mapper takes the title or name, brand, thumb and product type' do
    doc = DatasetDocumentMappers::Haystack.map({ 'name' => 'ProScreen', 'title' => '', 'brand' => 'Projecta', 'thumb' => 'http://x/y.jpg',
                                                 'product_type' => 'Screen', 'extra' => 'dropped' }, id: '325961')

    assert_equal({ 'id' => '325961', 'title' => 'ProScreen', 'brand' => 'Projecta', 'thumb' => 'http://x/y.jpg', 'category' => [ 'Screen' ] }, doc)
  end

  test 'the IMDb mapper takes the title, genres as categories and the average rating, and reads \N as no value' do
    doc = DatasetDocumentMappers::Imdb.map({ 'primaryTitle' => 'Rambo', 'genres' => 'Action,Drama', 'averageRating' => '7.8', 'startYear' => '\N' }, id: 'tt1')

    assert_equal({ 'id' => 'tt1', 'title' => 'Rambo', 'category' => %w[Action Drama], 'rating' => 7.8 }, doc)
    assert_equal({ 'id' => 'tt2', 'title' => 'Alone' }, DatasetDocumentMappers::Imdb.map({ 'primaryTitle' => 'Alone', 'genres' => '\N', 'averageRating' => '\N' }, id: 'tt2'))
  end

  test 'each dataset that can be loaded has a mapper' do
    assert_equal DatasetDocumentMappers::Haystack, DatasetCatalog.find('haystack').mapper
    assert_equal DatasetDocumentMappers::Imdb, DatasetCatalog.find('imdb').mapper
  end

  test 'the WANDS mapper takes the name, description, average rating, and the category path and class as categories' do
    row = { 'product_id' => '0', 'product_name' => 'solid wood platform bed', 'product_class' => 'Beds',
            'category hierarchy' => 'Furniture / Bedroom Furniture / Beds & Headboards / Beds / Twin Beds',
            'product_description' => 'good , deep sleep', 'product_features' => 'headboardtype : slat', 'rating_count' => '15.0',
            'average_rating' => '4.5', 'review_count' => '15.0' }

    assert_equal({ 'id' => '0', 'title' => 'solid wood platform bed', 'description' => 'good , deep sleep', 'rating' => 4.5,
                   'category' => [ 'Furniture', 'Bedroom Furniture', 'Beds & Headboards', 'Beds', 'Twin Beds' ] },
                 DatasetDocumentMappers::Wands.map(row, id: '0'))
  end

  test 'the WANDS mapper leaves out what a product does not have' do
    bare = { 'product_name' => 'mystery box', 'product_class' => 'Toys', 'category hierarchy' => '', 'product_description' => '', 'average_rating' => '4.0' }
    nothing = { 'product_name' => 'plain', 'product_class' => '', 'category hierarchy' => '', 'product_description' => '', 'average_rating' => '' }

    assert_equal({ 'id' => '3', 'title' => 'mystery box', 'rating' => 4.0, 'category' => [ 'Toys' ] }, DatasetDocumentMappers::Wands.map(bare, id: '3'))
    assert_equal({ 'id' => '4', 'title' => 'plain' }, DatasetDocumentMappers::Wands.map(nothing, id: '4'))
  end

  test 'a class that is also a level of the path is one category, not two' do
    row = { 'product_name' => 'x', 'product_class' => 'Beds', 'category hierarchy' => 'Furniture / Beds' }

    assert_equal %w[Furniture Beds], DatasetDocumentMappers::Wands.map(row, id: '1')['category']
  end
end
