# frozen_string_literal: true

require 'test_helper'

class DatasetTest < ActiveSupport::TestCase
  let(:user) { users(:random) }

  test 'for finds or creates the one record per user and dataset key' do
    first = Dataset.for(user, 'haystack')

    assert_predicate first, :persisted?
    assert_equal first, Dataset.for(user, 'haystack')
    assert_not_equal first, Dataset.for(users(:doug), 'haystack')
    assert_not_equal first, Dataset.for(user, 'imdb')
  end

  test 'a user has one record per key' do
    Dataset.create!(owner: user, key: 'haystack')

    assert_not Dataset.new(owner: user, key: 'haystack').valid?
  end

  test 'lists its cases, and forgets a case that was deleted' do
    dataset = Dataset.for(user, 'imdb')
    kept = Case.create!(case_name: 'Kept', owner: user)
    gone = Case.create!(case_name: 'Gone', owner: user)
    [ kept, gone ].each { |kase| CaseToDataset.create!(dataset: dataset, case: kase) }

    gone.destroy

    assert_equal [ kept ], dataset.cases.to_a
  end

  test 'a case belongs to at most one dataset' do
    kase = Case.create!(case_name: 'One', owner: user)
    CaseToDataset.create!(dataset: Dataset.for(user, 'imdb'), case: kase)

    assert_not CaseToDataset.new(dataset: Dataset.for(user, 'haystack'), case: kase).valid?
  end

  test 'destroying it removes its case links but not the cases' do
    dataset = Dataset.for(user, 'imdb')
    kase = Case.create!(case_name: 'Stays', owner: user)
    CaseToDataset.create!(dataset: dataset, case: kase)

    dataset.destroy

    assert_equal 0, CaseToDataset.count
    assert Case.exists?(kase.id)
  end

  test 'a case link starts pending and only takes known statuses' do
    link = CaseToDataset.create!(dataset: Dataset.for(user, 'imdb'), case: Case.create!(case_name: 'New', owner: user))

    assert_equal 'pending', link.status
    assert_predicate link, :in_progress?
    assert_not_predicate link, :failed?

    link.status = 'loading'

    assert_predicate link, :in_progress?

    link.status = 'done'

    assert_not_predicate link, :in_progress?

    link.status = 'failed'

    assert_predicate link, :failed?

    link.status = 'bogus'

    assert_not link.valid?
  end
end
