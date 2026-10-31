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

  test 'drop_orphans_of deletes the links of deleted cases, only for that owner, and keeps the live ones' do
    mine = Dataset.for(user, 'imdb')
    theirs = Dataset.for(users(:doug), 'imdb')
    live = Case.create!(case_name: 'Live', owner: user)
    gone = Case.create!(case_name: 'Gone', owner: user)
    their_gone = Case.create!(case_name: 'Their gone', owner: users(:doug))
    [ [ mine, live ], [ mine, gone ], [ theirs, their_gone ] ].each { |dataset, kase| CaseToDataset.create!(dataset: dataset, case: kase) }
    gone.destroy
    their_gone.destroy

    assert_difference 'CaseToDataset.count', -1 do
      CaseToDataset.drop_orphans_of(user)
    end

    assert_equal [ live.id ], mine.case_to_datasets.pluck(:case_id)
    assert_equal [ their_gone.id ], theirs.case_to_datasets.pluck(:case_id), 'another user\'s links are not touched'
  end
end
