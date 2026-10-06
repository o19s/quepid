# frozen_string_literal: true

require 'test_helper'

class AiJudgesControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  let(:ai_judge) { users(:judge_judy) }
  let(:team) { teams(:shared) }

  setup do
    login_user_for_integration_test user
  end

  test 'should get new' do
    get new_team_ai_judge_url(team_id: team.id)
    assert_response :success
  end

  test 'should create ai_judge' do
    assert_difference('User.count') do
      post team_ai_judges_url(team_id: team.id),
           params: { user: {
             name: ai_judge.name, llm_key: ai_judge.llm_key, system_prompt: ai_judge.system_prompt
           } }
    end
    assert_redirected_to team_url(id: team.id)
  end

  test 'should destroy ai_judge' do
    assert_difference('User.count', -1) do
      delete team_ai_judge_url(team_id: team.id, id: ai_judge.id)
    end

    assert_redirected_to team_url(id: team.id)
  end
  test 'new offers the chat prompt, and ships every stock prompt for the switcher' do
    get new_ai_judge_url

    assert_select 'textarea[name=?]', 'user[system_prompt]', text: /scale of 0 to 3/

    stock = css_select('[data-controller~="ai-judge-form"]').first['data-ai-judge-form-stock-prompts-value']

    assert_not_nil stock, 'stock prompts were not rendered into the wizard'
    assert_equal LlmProvider.stock_system_prompts, JSON.parse(stock)
    defaults = JSON.parse(css_select('[data-controller~="ai-judge-form"]').first['data-ai-judge-form-option-defaults-value'])
    assert_equal LlmService::DEFAULT_OPTIONS.stringify_keys.merge('llm_provider' => 'openai', 'llm_api_version' => ''), defaults
  end

  test 'new offers a provider own option as a field, inert until that provider is chosen' do
    get new_ai_judge_url

    assert_select '.provider-option-field[data-provider=?]', 'typesafe_jev' do
      assert_select 'input#judge_options_jev_min_confidence[type=number][min=?][max=?][step=?]', '0', '1', '0.1'
    end
  end

  test 'a provider own option is stored in the judge options json, with no new column' do
    post ai_judges_url,
         params: { user: {
           name:          'Picky Jev',
           llm_key:       'abc123',
           system_prompt: 'Judge this',
           judge_options: { llm_provider: 'typesafe_jev', jev_min_confidence: '0.4' },
         } }

    judge = AiJudge.order(:id).last

    assert_equal '0.4', judge.judge_options[:jev_min_confidence]
    assert_equal '0.4', judge.options.dig('judge_options', 'jev_min_confidence')
  end

  test 'edit renders the provider dropdown for judge_options saved before llm_provider existed' do
    assert_nil ai_judge.judge_options[:llm_provider], "fixture shouldn't carry llm_provider, to match a pre-existing judge"

    get edit_ai_judge_url(ai_judge)

    assert_response :success
    assert_select 'select#judge_options_llm_provider'
  end

  test 'saves a judge pointed at a provider that is available' do
    assert_difference('User.count', 1) do
      post ai_judges_url,
           params: { user: {
             name:          'Jev Judge',
             llm_key:       'abc123',
             system_prompt: 'Judge this',
             judge_options: { llm_provider: 'typesafe_jev' },
           } }
    end

    assert_redirected_to ai_judge_url(AiJudge.order(:id).last)
    assert_equal 'typesafe_jev', AiJudge.order(:id).last.judge_options[:llm_provider]
  end
  test 'provider selection and presets share the registry' do
    get new_ai_judge_url
    LlmProvider.each do |provider|
      assert_select 'select#judge_options_llm_provider option[value=?]', provider.key, text: provider.label
      assert_select 'template[data-provider=?]', provider.key
    end
  end

  test 'a saved Jev judge renders a disabled preview without an accessible scale' do
    ai_judge.update!(judge_options: { llm_provider: 'typesafe_jev' })
    get edit_ai_judge_url(ai_judge)
    assert_response :success
    assert_select '[data-ai-judge-wizard-target=runPromptButton][disabled]'
    assert_select '[data-ai-judge-form-target=needsScaleNotice]:not([style*="display:none"])', text: /Judgement Stats/
    assert_select '#judge_options_llm_include_images[disabled]:not([checked])'
  end
end
