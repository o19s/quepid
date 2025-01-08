# frozen_string_literal: true

require 'test_helper'

module AiJudges
  class PromptControllerTest < ActionDispatch::IntegrationTest
    let(:user) { users(:random) }
    let(:ai_judge) { users(:judge_judy) }
    let(:team) { teams(:shared) }

    setup do
      login_user_for_integration_test user
    end

    test 'should get edit' do
      get edit_ai_judge_prompt_url(ai_judge_id: ai_judge.id)
      assert_response :success
    end

    # test 'should get update' do
    #   patch ai_judge_prompt_url
    #   assert_response :success
    # end
  end
end
