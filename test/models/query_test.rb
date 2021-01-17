# frozen_string_literal: true

# == Schema Information
#
# Table name: queries
#
#  id             :integer          not null, primary key
#  arranged_next  :integer
#  arranged_at    :integer
#  deleted        :boolean
#  query_text     :string(191)
#  notes          :text(65535)
#  threshold      :float(24)
#  threshold_enbl :boolean
#  case_id        :integer
#  scorer_id      :integer
#  scorer_enbl    :boolean
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  options        :text(65535)
#

require 'test_helper'

class QueryTest < ActiveSupport::TestCase
  describe 'position' do
    let(:queries_case) { cases(:queries_case) }

    before do
      Arrangement::List.sequence queries_case.queries
    end

    test 'bootstraps new query with default position values' do
      new_case = Case.create case_name: 'New Case'
      new_query = new_case.queries.create query_text: 'New query'

      assert_equal new_query.arranged_at,   Arrangement::List::STARTING_POSITION
      assert_equal new_query.arranged_next, Arrangement::List::ENDING_POSITION
    end

    test 'adds a new query to the top of the list by default' do
      last_query_pre  = queries_case.queries.last
      first_query_pre = queries_case.queries.first

      query = queries_case.queries.create(query_text: 'insert me at the top')

      # Save the case to automatically save any changed queries
      # and reload to get the updated attribute data
      queries_case.save
      first_query_pre.reload
      queries_case.reload

      assert_equal query.arranged_next, first_query_pre.arranged_at

      first_query = queries_case.queries.first
      assert_equal query, first_query

      last_query_post = queries_case.queries.last
      assert_equal last_query_post, last_query_pre
    end

    test 'inserts a new query at the position provided and moves other queries' do
      position  = 2
      query_pre = queries_case.queries[position - 1]

      count = queries_case.queries.count
      query = queries_case.queries.create(query_text: 'insert me at position')

      query.insert_at position

      # Save the case to automatically save any changed queries
      # and reload to get the updated attribute data
      queries_case.save
      query_pre.reload
      queries_case.reload

      assert_equal count + 1,         queries_case.queries.count
      assert_equal query,             queries_case.queries[position]
      assert_equal query.arranged_at, query_pre.arranged_next
    end

    test 'fetches list of queries ordered by arranged at' do
      list = queries_case.queries

      previous_query = list.first
      list[1..].each do |query|
        assert previous_query.arranged_at < query.arranged_at
        assert_equal previous_query.arranged_next, query.arranged_at
        previous_query = query
      end
    end

    test 'removes first element form the list and rearranges list' do
      first = queries_case.queries.first

      first.remove_from_list

      # Save the case to automatically save any changed queries
      # and reload to get the updated attribute data
      queries_case.save
      queries_case.reload
      first.reload

      assert_nil first.arranged_next
      assert_nil first.arranged_at

      new_first = queries_case.queries.where(arranged_at: 0)
      assert_not_equal first, new_first
    end

    test 'removes random element form the list and rearranges list' do
      index = (1..queries_case.queries.length - 1).to_a.sample
      query = queries_case.queries[index]

      query.remove_from_list

      # Save the case to automatically save any changed queries
      # and reload to get the updated attribute data
      queries_case.save
      queries_case.reload
      query.reload

      assert_nil query.arranged_next
      assert_nil query.arranged_at

      new_position = queries_case.queries[index]
      assert_not_equal query, new_position
    end

    test 'moves query to beginning of the list' do
      first = queries_case.queries.first
      query = queries(:third_query)

      query.move_to first.id, true

      query.save
      queries_case.reload

      assert_equal query, queries_case.queries.first
    end

    test 'moves query to the end of the list' do
      last = queries_case.queries.last
      query = queries(:third_query)

      query.move_to last.id, false

      query.save
      queries_case.reload

      assert_equal query, queries_case.queries.last
    end

    test 'moves query to the middle of the list backwards' do
      middle  = queries_case.queries[1]
      query   = queries_case.queries[3]

      query.move_to middle.id, true

      query.save
      queries_case.reload

      assert_equal query, queries_case.queries[1]
    end

    test 'moves query to the middle of the list forward' do
      middle  = queries_case.queries[2]
      query   = queries_case.queries[0]

      query.move_to middle.id, false

      query.save
      queries_case.reload

      assert_equal query, queries_case.queries[2]
    end
  end

  describe 'Soft deletion' do
    let(:query) { queries(:one) }

    test 'marks query as deleted but does not actually delete query' do
      assert_difference 'Query.unscoped.where(deleted: true).count' do
        query.soft_delete
        query.reload

        assert_equal query.deleted, true
      end
    end

    test 'does not fetch queries marked as deleted by default' do
      query.soft_delete

      queries = Query.all
      ids     = queries.map(&:id)

      assert_not_includes ids, query.id
    end

    test 'returns query if deleted is marked as nil' do
      queries = Query.all
      ids     = queries.map(&:id)

      assert_includes ids, query.id
    end

    test 'returns query if deleted is marked as false' do
      query.update deleted: false
      queries = Query.all
      ids     = queries.map(&:id)

      assert_includes ids, query.id
    end
  end

  describe 'test' do
    let(:query) { queries(:one) }

    test 'adds a new test' do
      mytest = Scorer.new(code: 'pass();', query_test: true)
      query.test = mytest
      query.save

      query.reload

      assert_not_nil query.test
      assert_equal 'pass();', query.test.code
    end

    test 'always fetches the last test' do
      query.test = Scorer.new(code: 'pass();', query_test: true)
      query.save
      query.reload

      query.test = Scorer.new(code: 'fail();', query_test: true)
      query.save
      query.reload

      assert_not_nil query.test
      assert_equal 'fail();', query.test.code
    end
  end

  describe 'query scoping with ratings and with ratings' do
    let(:query)               { queries(:query_with_empty_ratings) }
    let(:rating_with_rating)  { ratings(:rating_with_rating) }

    test 'always fetches all the ratings' do
      assert_equal 2, query.ratings.size
    end

    test 'can filter out ratings that do not have a rating set' do
      assert_equal 1, query.ratings.fully_rated.size
      assert_includes query.ratings.fully_rated, rating_with_rating
    end
  end
end
