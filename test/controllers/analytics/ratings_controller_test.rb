# frozen_string_literal: true

require 'test_helper'

module Analytics
  class RatingsControllerTest < ActionController::TestCase
    let(:phasers_vs_sabers)   { cases(:phasers_vs_sabers) }
    let(:kirk)                { users(:kirk) }
    let(:luke)                { users(:luke) }

    before do
      @controller = Analytics::RatingsController.new
      login_user luke
    end

    describe 'Fetching a case' do
      test 'should get ratings for case' do
        get :show, params: { case_id: phasers_vs_sabers.id }
        assert_response :ok

        assert_response :success

        assert_not_nil assigns(:case)
        assert_not_nil assigns(:df)

        df2 = assigns(:df)
        puts df2.to_csv
      end
    end
  end
end
