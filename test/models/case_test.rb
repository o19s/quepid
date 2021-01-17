# frozen_string_literal: true

# == Schema Information
#
# Table name: cases
#
#  id              :integer          not null, primary key
#  case_name       :string(191)
#  last_try_number :integer
#  user_id         :integer
#  archived        :boolean
#  scorer_id       :integer
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#

require 'test_helper'

class CaseTest < ActiveSupport::TestCase
  describe 'Creating a case' do
    test 'sets archived flag to false by default' do
      acase = Case.create(case_name: 'test case')

      assert_equal acase.archived, false
    end

    test 'does not override archived flag if set' do
      acase = Case.create(case_name: 'test case', archived: true)

      assert_equal acase.archived, true
    end

    test "sets the scorer to the user's scorer" do
      user_scorer         = scorers(:random_scorer)
      user                = users(:random)
      user.default_scorer = user_scorer
      user.save

      acase = Case.create(case_name: 'with default scorer', user: user)

      assert_equal acase.scorer_id, user_scorer.id
      assert_equal acase.scorer_id, user.default_scorer_id
    end

    test "sets the scorer to the user's quepid scorer" do
      q_scorer            = scorers(:v1)
      user                = users(:random)
      user.default_scorer = q_scorer
      user.save

      acase = Case.create(case_name: 'with q scorer', user: user)

      assert_equal acase.scorer_id, q_scorer.id
      assert_equal acase.scorer.communal, true
    end

    test "sets the scorer to the user's scorer even when a q score is available" do
      user_scorer         = scorers(:random_scorer)
      user                = users(:random)
      user.default_scorer = user_scorer
      user.save

      acase = Case.create(case_name: 'with default scorer', user: user)

      assert_equal acase.scorer_id,       user_scorer.id
      assert_equal acase.scorer_id,       user.default_scorer_id
      assert_equal acase.scorer.communal, false
    end

    test "sets the scorer to the QUEPID_DEFAULT_SCORER if the user doesn't have one picked" do
      q_scorer2 = scorers(:quepid_default_scorer)
      user      = users(:random)

      acase = Case.create(case_name: 'with default scorer', user: user)

      assert_equal acase.scorer_id, q_scorer2.id
      assert_equal acase.scorer.communal, true
      assert_equal Rails.application.config.quepid_default_scorer, q_scorer2.name
    end

    test "does not override the case scorer with the user's scorer" do
      user_scorer         = scorers(:random_scorer)
      case_scorer         = scorers(:random_scorer_1)
      user                = users(:random)
      user.default_scorer = user_scorer
      user.save

      acase = Case.create(case_name: 'with default scorer', user: user, scorer: case_scorer)

      assert_equal acase.scorer_id, case_scorer.id
      assert_not_equal acase.scorer_id, user_scorer.id
      assert_not_equal acase.scorer_id, user.default_scorer_id
    end

    test 'automatically creates a default try' do
      acase = Case.create(case_name: 'test case')

      assert_equal acase.tries.count, 1
    end

    test 'sets the last try of the case' do
      acase = Case.create(case_name: 'test case')

      default_try = acase.tries.first

      assert_equal default_try.try_number, acase.last_try_number
      assert_equal default_try.try_number, 1
    end

    test 'returns try from highest try number (therefore newest) to lowest' do
      acase = cases(:case_with_two_tries)

      assert_equal acase.tries.first.try_number,  2
      assert_equal acase.tries.second.try_number, 1
    end

    test 'sets the default try to the default search engine attributes' do
      acase = Case.create(case_name: 'test case')

      default_try = acase.tries.first
      assert_not_nil default_try

      assert_equal default_try.search_engine, Try::DEFAULTS[:search_engine]
      assert_equal default_try.field_spec,    Try::DEFAULTS[:solr][:field_spec]
      assert_equal default_try.search_url,    Try::DEFAULTS[:solr][:search_url]
      assert_equal default_try.query_params,  Try::DEFAULTS[:solr][:query_params]
      assert_equal default_try.escape_query,  true
    end
  end

  describe 'clone' do
    let(:user)        { users(:random) }
    let(:the_case)    { cases(:random_case) }
    let(:the_try)     { the_case.tries.best }
    let(:cloned_case) { Case.new(case_name: 'Cloned Case') }

    describe 'when only cloning a try' do
      it 'creates a new case' do
        assert_difference 'Case.count' do
          assert_difference 'Try.count' do
            cloned_case.clone_case the_case, user, try: the_try

            assert_equal 1, cloned_case.tries.size
            assert_equal 0, cloned_case.queries.size
            assert_equal user.id, cloned_case.user_id

            assert_equal 'Cloned Case', cloned_case.case_name

            cloned_try = cloned_case.tries.best

            assert_equal the_try.query_params,  cloned_try.query_params
            assert_equal the_try.field_spec,    cloned_try.field_spec
            assert_equal the_try.search_url,    cloned_try.search_url
            assert_equal 'Try 0',               cloned_try.name
            assert_equal 0, cloned_case.tries.first.try_number
            assert_equal the_try.search_engine, cloned_try.search_engine
            assert_equal the_try.escape_query,  cloned_try.escape_query
          end
        end
      end
    end

    describe 'when cloning the full try history' do
      it 'creates a new case with all of the tries from the original case' do
        assert_difference 'Case.count' do
          assert_difference 'Try.count', the_case.tries.count do
            cloned_case.clone_case the_case, user, preserve_history: true

            assert_equal the_case.tries.count, cloned_case.tries.count
            assert_equal 0, cloned_case.queries.count
            assert_equal user.id, cloned_case.user_id

            the_case.tries.each_with_index do |a_try, idx|
              assert_equal cloned_case.tries[idx].try_number, a_try.try_number
            end
          end
        end
      end
    end

    describe 'when cloning a try and the queries' do
      it 'creates a new case with the same queries' do
        assert_difference 'Case.count' do
          assert_difference 'Query.count', the_case.queries.count do
            cloned_case.clone_case the_case, user, try: the_try, clone_queries: true

            assert_equal 1, cloned_case.tries.size
            assert_equal the_case.queries.size, cloned_case.queries.size
            assert_equal user.id, cloned_case.user_id
            assert_equal 0, cloned_case.last_try_number
            assert_equal 0, cloned_case.tries.first.try_number
          end
        end
      end
    end

    describe 'when cloning a try and the queries and the ratings' do
      it 'creates a new case with the same queries and the same ratings' do
        assert_difference 'Case.count' do
          assert_difference 'Query.count', the_case.queries.count do
            query = the_case.queries.first
            new_rating = Rating.new(
              doc_id: '42',
              rating: '8'
            )
            query.ratings << new_rating

            cloned_case.clone_case the_case, user, try: the_try, clone_queries: true, clone_ratings: true

            assert_equal the_case.queries.count, cloned_case.queries.count
            assert_equal 1, cloned_case.tries.count
            assert_equal 0, cloned_case.last_try_number
            assert_equal 0, cloned_case.tries.first.try_number
            assert_equal the_case.queries.count, cloned_case.queries.count
            # assert_equal the_case.ratings.count, cloned_case.ratings.count
            assert_equal user.id, cloned_case.user_id
          end
        end
      end
    end
  end
end
