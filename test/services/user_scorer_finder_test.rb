# frozen_string_literal: true

require 'test_helper'

# We used to have a complex "UserScorerFinder" class that used some
# method missing etc magic to let us build up a AREL object.
# That doesn't seem to be as needed now with Scopes.  The
# tests are here to verify things still work without the class.

class UserScorerFinderTest < ActiveSupport::TestCase
  let(:user)                  { users(:doug) }
  let(:owned_scorer)          { scorers(:owned_scorer) }
  let(:shared_scorer)         { scorers(:shared_scorer) }
  let(:communal_scorer)       { scorers(:communal_scorer) }

  let(:quepid_default_scorer) { scorers(:quepid_default_scorer) }

  # let(:service)               { UserScorerFinder.new(doug) }

  describe 'Find all scorers' do
    test 'returns an array of scorers' do
      result = user.scorers_involved_with.all

      assert_equal 'Scorer::ActiveRecord_Relation', result.class.to_s
    end

    test 'includes scorers owned by user' do
      result = user.scorers_involved_with.all

      assert_includes result, owned_scorer
    end

    test 'includes scorers shared with user' do
      result = user.scorers_involved_with.all

      assert_includes result, shared_scorer
    end

    # In ActiveRecord 4.2 we don't have the OR clause
    # working in AREL so we can't OR on the scorer table in
    # the scorer.for_user method.  When we upgrade then
    # enable this test!
    # test 'includes all communal scorers' do
    #   result = user.scorers.all

    #   assert_includes result, communal_scorer
    # end
  end

  describe 'Find all scorers that match params' do
    test 'returns an empty array if no results match' do
      result = user.scorers_involved_with.where(id: 123).all

      assert_equal        'Scorer::ActiveRecord_Relation', result.class.to_s
      assert_equal        0, result.length
    end

    test 'works when filtering by id' do
      result = user.scorers_involved_with.where(id: owned_scorer.id).all

      assert_equal        'Scorer::ActiveRecord_Relation', result.class.to_s
      assert_equal        1,      result.length
      assert_includes     result, owned_scorer
    end

    test 'works with complex where clause for owned scorers' do
      result = user.scorers_involved_with.where('`scorers`.`name` LIKE ?', '%Owned%').all

      assert_equal        'Scorer::ActiveRecord_Relation', result.class.to_s
      assert_equal        3,      result.length
      assert_includes     result, owned_scorer
    end

    test 'works with complex where clause for shared scorers' do
      result = user.scorers_involved_with.where('`scorers`.`name` LIKE ?', '%Shared%').all

      assert_equal        'Scorer::ActiveRecord_Relation', result.class.to_s
      assert_equal        3,      result.length
      assert_not_includes result, owned_scorer
      assert_includes     result, shared_scorer
    end

    test 'works when querying on the name for owned scorers' do
      result = user.scorers_involved_with.where(name: 'Owned Scorer').all

      assert_equal        'Scorer::ActiveRecord_Relation', result.class.to_s
      assert_equal        1,      result.length
      assert_includes     result, owned_scorer
    end

    test 'works when querying on the name for shared scorers' do
      result = user.scorers_involved_with.where(name: 'Shared Scorer').all

      assert_equal        'Scorer::ActiveRecord_Relation', result.class.to_s
      assert_equal        1,      result.length
      assert_not_includes result, owned_scorer
      assert_includes     result, shared_scorer
    end
  end

  describe 'Find first scorer that matches params' do
    test 'returns nil if no results match' do
      result = user.scorers_involved_with.where(id: 123).first

      assert_nil result
    end

    test 'works when filtering by id' do
      result = user.scorers_involved_with.where(id: owned_scorer.id)
        .order(name: :asc)
        .first

      assert_instance_of  Scorer, result
      assert_equal        result, owned_scorer
    end

    test 'works with complex where clause for owned scorers' do
      result = user.scorers_involved_with.where('`scorers`.`name` LIKE ?', '%Owned%')
        .order(name: :asc)
        .first

      assert_instance_of  Scorer, result
      assert_equal        result, owned_scorer
    end

    test 'works with complex where clause for shared scorers' do
      result = user.scorers_involved_with.where('`scorers`.`name` LIKE ?', '%Shared%')
        .order(name: :asc)
        .first

      assert_instance_of  Scorer, result
      assert_not_equal    result, owned_scorer
      assert_equal        result, shared_scorer
    end

    test 'works when querying on the name for owned scorers' do
      result = user.scorers_involved_with.where(name: 'Owned Scorer')
        .order(name: :asc)
        .first

      assert_instance_of  Scorer, result
      assert_equal        result, owned_scorer
    end

    test 'works when querying on the name for shared scorers' do
      result = user.scorers_involved_with.where(name: 'Shared Scorer')
        .order(name: :asc)
        .first

      assert_instance_of  Scorer, result
      assert_not_equal    result, owned_scorer
      assert_equal        result, shared_scorer
    end
  end

  describe 'Find last scorer that matches params' do
    test 'returns nil if no results match' do
      result = user.scorers_involved_with.where(id: 123).last

      assert_nil result
    end

    test 'works when filtering by id' do
      result = user.scorers_involved_with.where(id: owned_scorer.id)
        .order(name: :desc)
        .last

      assert_instance_of  Scorer, result
      assert_equal        result, owned_scorer
    end

    test 'works with complex where clause for owned scorers' do
      result = user.scorers_involved_with.where('`scorers`.`name` LIKE ?', '%Owned%')
        .order(name: :desc)
        .last

      assert_instance_of  Scorer, result
      assert_equal        result, owned_scorer
    end

    test 'works with complex where clause for shared scorers' do
      result = user.scorers_involved_with.where('`scorers`.`name` LIKE ?', '%Shared%')
        .order(name: :desc)
        .last

      assert_instance_of  Scorer, result
      assert_not_equal    result, owned_scorer
      assert_equal        result, shared_scorer
    end

    test 'works when querying on the name for owned scorers' do
      result = user.scorers_involved_with.where(name: 'Owned Scorer')
        .order(name: :desc)
        .last

      assert_instance_of  Scorer, result
      assert_equal        result, owned_scorer
    end

    test 'works when querying on the name for shared scorers' do
      result = user.scorers_involved_with.where(name: 'Shared Scorer')
        .order(name: :desc)
        .last

      assert_instance_of  Scorer, result
      assert_not_equal    result, owned_scorer
      assert_equal        result, shared_scorer
    end

    test 'includes the default communal scorer' do
      result = user.scorers_involved_with.all

      assert_includes result, quepid_default_scorer
    end
  end
end

