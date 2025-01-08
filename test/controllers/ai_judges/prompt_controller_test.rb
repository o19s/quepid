# frozen_string_literal: true

require 'test_helper'

module AiJudges
  class PromptControllerTest < ActionDispatch::IntegrationTest
    test 'should get edit' do
      get ai_judges_prompt_edit_url
      assert_response :success
    end

    test 'should get update' do
      get ai_judges_prompt_update_url
      assert_response :success
    end
  end
end
