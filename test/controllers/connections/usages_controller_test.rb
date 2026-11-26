# frozen_string_literal: true

require 'test_helper'

module Connections
  class UsagesControllerTest < ActionDispatch::IntegrationTest
    let(:connection) { connections(:openai) }

    setup do
      login_user_for_integration_test users(:doug)
    end

    test 'lists accessible embedders with links and no connection credentials' do
      get connection_usage_url(connection, kind: 'embedders')

      assert_response :success
      assert_select '[data-connection-usage-list] a[href=?]', edit_embedder_path(embedders(:openai_small)), text: 'OpenAI small'
      assert_no_match(/sk-test-openai/, response.body)
      assert_no_match(/<!DOCTYPE|<html/i, response.body)
    end

    test 'lists AI judges separately from embedders' do
      judge = AiJudge.create!(name: 'Usage judge', owner: users(:doug), connection: connection, system_prompt: 'Judge it.')

      get connection_usage_url(connection, kind: 'ai_judges')

      assert_response :success
      assert_select 'a[href=?]', edit_ai_judge_path(judge), text: 'Usage judge'
      assert_select 'a[href=?]', edit_embedder_path(embedders(:openai_small)), count: 0
    end

    test 'an instance-wide connection does not reveal another owners private usages' do
      connection.update!(instance_wide: true)
      AiJudge.create!(name: 'Private usage judge', owner: users(:joey), connection: connection, system_prompt: 'Judge it.')
      login_user_for_integration_test users(:random)

      get connection_usage_url(connection, kind: 'ai_judges')

      assert_response :success
      assert_no_match(/Private usage judge/, response.body)
      assert_select '[data-connection-usage-list]', text: /No AI judges you can access/

      get connection_usage_url(connection, kind: 'embedders')

      assert_select 'a[href=?]', edit_embedder_path(embedders(:openai_small))
    end

    test 'rejects a connection the viewer cannot access' do
      get connection_usage_url(connections(:private_ollama), kind: 'embedders')

      assert_response :not_found
    end

    test 'rejects unsupported usage kinds' do
      get connection_usage_url(connection, kind: 'owners')

      assert_response :bad_request
    end
  end
end
