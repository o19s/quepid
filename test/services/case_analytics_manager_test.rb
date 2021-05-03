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
        assert_equal 0.5, manager.case_ratings_variance
      end
    end
  end
end
