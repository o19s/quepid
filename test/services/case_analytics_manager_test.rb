# frozen_string_literal: true

require 'test_helper'

class CaseAnalyticsManagerTest < ActiveSupport::TestCase
  let(:manager) { CaseAnalyticsManager.new the_case }

  describe '#checking setup of case' do
    describe 'when case shared with a team' do
      let(:the_case) { cases(:shared_with_team) }

      test 'can calculate a case variance' do
        assert manager.can_calculate_variances?
      end

      test 'we have a max label' do
        assert_not_nil manager.max_label
      end
    end

    describe 'when standalone case' do
      let(:the_case) { cases(:with_metadata) }

      test 'wont calculate a case variance' do
        assert_not manager.can_calculate_variances?
      end
    end
  end

  describe '#calculations at case level' do
    describe 'when case shared with a team that does not have multiple raters' do
      let(:the_case) { cases(:shared_with_team) }

      test 'can calculate a variance for the ratings over the entire case' do
        assert_equal 'NaN', manager.case_ratings_variance.to_s
      end
    end

    describe 'when case shared with a team with multiple raters' do
      let(:the_case) { cases(:phasers_vs_sabers) }

      test 'can calculate a variance for the ratings over the entire case' do
        puts "With Nate we got a 0.5, without nate, it's an array of .5,0,0,0,0, leading to .125"
        # assert_equal 0.5, manager.case_ratings_variance
        assert_equal 0.13, manager.case_ratings_variance
      end
    end
  end

  describe '#calculations at the query/doc level' do
    let(:the_case) { cases(:phasers_vs_sabers) }
    let(:the_query) { queries(:star) }

    test 'can calculate a variance for all the ratings for a specific doc id' do
      ratings = the_query.ratings.where(doc_id: 'star_is_born')
      assert_equal 2, ratings.size

      assert_equal 0.5, manager.query_doc_ratings_variance(ratings)
    end
  end

  describe '#calculations at the query level' do
    let(:the_case) { cases(:phasers_vs_sabers) }
    let(:the_query) { queries(:star) }

    test 'can calculate a variance for all the ratings for a specific doc id' do
      ratings_by_doc_id = Query.group_by_doc_id_version_two(the_query.ratings)

      assert_equal 4, ratings_by_doc_id.keys.size
      variances = []
      ratings_by_doc_id.each do |_key, ratings|
        rating_values = ratings.map(&:rating)
        variances << manager.variance(rating_values)
      end
      assert_equal 0.125, manager.query_rating_variance_average(variances)
    end
  end

  describe '#calculations without fixtures' do
    test 'crawling through the math' do
      query = Query.new(query_text: 'test')
      query.ratings << Rating.new(doc_id: 'a', rating: 0)
      query.ratings << Rating.new(doc_id: 'a', rating: 1)
      query.ratings << Rating.new(doc_id: 'b', rating: 1)
      query.ratings << Rating.new(doc_id: 'c', rating: 1)
      query.ratings << Rating.new(doc_id: 'c', rating: 1)
      query.ratings << Rating.new(doc_id: 'c', rating: 1)

      grouping = CaseAnalyticsManager.group_by_doc_id_version_two(query.ratings)
      assert_equal 3, grouping.keys.size
      assert_equal 2, grouping['a'].size
      assert_equal 1, grouping['b'].size
      assert_equal 3, grouping['c'].size

      assert_equal 0.5, CaseAnalyticsManager.variance_two(grouping['a'].map(&:rating))
      assert CaseAnalyticsManager.variance_two(grouping['b'].map(&:rating)).nan?
      assert_equal 0, CaseAnalyticsManager.variance_two(grouping['c'].map(&:rating))

      assert_equal 0.25, CaseAnalyticsManager.query_rating_variance_average_two(query)
    end

    test 'query with no ratings has variance average of Zero' do
      query = Query.new(query_text: 'test')
      assert query.ratings.empty?
      assert_equal 0, CaseAnalyticsManager.query_rating_variance_average_two(query)
    end
  end
end
