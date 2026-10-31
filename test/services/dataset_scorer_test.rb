# frozen_string_literal: true

require 'test_helper'

class DatasetScorerTest < ActiveSupport::TestCase
  let(:user) { users(:random) }
  let(:graded) do
    DatasetCatalog::Entry.new(key: 'shoes', name: 'Shoes', scale_labels: { '0' => 'Irrelevant', '1' => 'Complement', '2' => 'Substitute', '3' => 'Exact' })
  end
  let(:binary) { DatasetCatalog::Entry.new(key: 'hats', name: 'Hats', scale_labels: { '0' => 'No', '1' => 'Yes' }) }

  setup do
    Scorer.find_or_create_by!(name: 'AP@10') { |scorer| scorer.assign_attributes(scale: [ 0, 1 ], communal: true, code: 'setScore(1);') }
  end

  test 'builds a scorer named after the dataset and the AP@10 template, with the labels of the dataset' do
    scorer = DatasetScorer.new(user).find_or_create(graded)

    assert_equal 'Shoes AP@10', scorer.name
    assert_equal user, scorer.owner
    assert_not scorer.communal
    assert_equal [ 0, 1, 2, 3 ], scorer.scale
    assert_equal graded.scale_labels, scorer.scale_with_labels
    assert scorer.show_scale_labels
    assert_equal Scorer.communal.find_by(name: 'AP@10').code, scorer.code
  end

  test 'find returns nil until the scorer is built, then the same scorer' do
    assert_nil DatasetScorer.new(user).find(graded)

    built = DatasetScorer.new(user).find_or_create(graded)

    assert_equal built, DatasetScorer.new(user).find(graded)
    assert_equal built, Dataset.find_by(owner: user, key: 'shoes').scorer
    assert_nil DatasetScorer.new(users(:doug)).find(graded)
  end

  test 'builds a scorer per template, each named after it' do
    other = Scorer.create!(name: 'DCG@10 copy', communal: true, scale: [ 0, 1, 2, 3 ], code: 'setScore(2);')

    first = DatasetScorer.new(user).find_or_create(graded)
    second = DatasetScorer.new(user).find_or_create(graded, other)

    assert_equal [ 'Shoes AP@10', 'Shoes DCG@10 copy' ], [ first.name, second.name ]
    assert_equal 'setScore(2);', second.code
    assert_equal second, Dataset.find_by(owner: user, key: 'shoes').scorer, 'the latest is the one remembered'
  end

  test 'templates_left leaves out the templates already built from' do
    Scorer.communal.where.not(name: 'AP@10').delete_all
    assert_equal [ 'AP@10' ], DatasetScorer.new(user).templates_left(graded).map(&:name)

    DatasetScorer.new(user).find_or_create(graded)

    assert_empty DatasetScorer.new(user).templates_left(graded)
  end

  test 'reuses the scorer it built before' do
    first = DatasetScorer.new(user).find_or_create(graded)

    assert_no_difference 'Scorer.count' do
      assert_equal first, DatasetScorer.new(user).find_or_create(graded)
    end
  end

  test 'builds yes/no labels on the AP@10 template too' do
    scorer = DatasetScorer.new(user).find_or_create(binary)

    assert_equal 'Hats AP@10', scorer.name
    assert_equal Scorer.communal.find_by(name: 'AP@10').code, scorer.code
  end

  test 'fails clearly when the metric to build on is missing' do
    Scorer.where(name: 'AP@10').destroy_all

    assert_raises(DatasetScorer::Error) { DatasetScorer.new(user).find_or_create(graded) }
  end
end
