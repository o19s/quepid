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
    get new_ai_judge_url
    assert_response :success
  end

  test 'should get new with a team pre-selected from the team page' do
    get new_ai_judge_url(team_id: team.id)
    assert_response :success
    assert_equal [ team.id ], assigns(:ai_judge).team_ids
    assert_select "input[type=checkbox][value='#{team.id}'][checked]"
  end

  test 'new renders the provider dropdown and presets from the LlmProviders registry' do
    get new_ai_judge_url

    LlmProviders.each do |provider|
      assert_select 'select#judge_options_llm_provider option[value=?]', provider.key, text: provider.label
    end
    wizard = css_select('[data-controller="ai-judge-wizard"]').first
    presets_json = wizard['data-ai-judge-wizard-presets-value']

    assert_not_nil presets_json, 'presets were not rendered into the wizard'
    assert_equal LlmProviders.presets.deep_stringify_keys, JSON.parse(presets_json)
  end

  test 'should update ai_judge and flash a success notice' do
    patch ai_judge_url(ai_judge),
          params: { user: {
            name: 'Renamed Judge', llm_key: ai_judge.llm_key, system_prompt: ai_judge.system_prompt
          } }

    assert_redirected_to ai_judge_path(ai_judge)
    assert_equal 'AI Judge was successfully updated.', flash[:notice]
    assert_equal 'Renamed Judge', ai_judge.reload.name
  end

  test 'a validation failure on update keeps the book context the request arrived with' do
    book = books(:james_bond_movies)

    patch ai_judge_url(ai_judge), params: { book_id: book.id, user: { name: '' } }

    assert_response :success
    assert_select '[data-ai-judge-wizard-has-book-value=true]'
  end

  test 'should create ai_judge with no team (owner-only)' do
    assert_difference('User.count') do
      post ai_judges_url,
           params: { user: {
             name: ai_judge.name, llm_key: ai_judge.llm_key, system_prompt: ai_judge.system_prompt
           } }
    end
    new_judge = User.order(:id).last
    assert_equal user, new_judge.owner
    assert_empty new_judge.teams
    assert_redirected_to ai_judge_url(new_judge)
    assert_equal 'AI Judge was successfully created.', flash[:notice]
  end

  test 'should create ai_judge and share it with a team in the same request' do
    assert_difference('User.count') do
      post ai_judges_url,
           params: { user: {
             name: ai_judge.name, llm_key: ai_judge.llm_key, system_prompt: ai_judge.system_prompt,
             team_ids: [ team.id ]
           } }
    end
    new_judge = User.order(:id).last
    assert_includes new_judge.teams, team
  end

  test 'new offers the chat prompt, and ships every stock prompt for the switcher' do
    get new_ai_judge_url

    assert_select 'textarea[name=?]', 'user[system_prompt]', text: /scale of 0 to 3/

    stock = css_select('[data-controller="ai-judge-wizard"]').first['data-ai-judge-wizard-stock-prompts-value']

    assert_not_nil stock, 'stock prompts were not rendered into the wizard'
    assert_equal LlmProviders.stock_system_prompts, JSON.parse(stock)
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

  test 'new renders the banner element placeholder providers would use' do
    get new_ai_judge_url

    assert_select 'div#provider-notice'
    assert_select 'select#judge_options_llm_provider option[value=?]', 'typesafe_jev'
  end

  # The refusal path (a provider carrying a coming-soon notice cannot be saved)
  # has no provider to exercise it now that Jev is real; the rule itself is
  # tested as LlmProvider#coming_soon? in test/models/llm_providers_test.rb.
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

  describe 'edit, as the page to refine a prompt on' do
    let(:book) { books(:james_bond_movies) }

    test 'flags instructions written for another kind of model, and offers the right default' do
      ai_judge.update!(system_prompt: LlmProviders::CHAT_SYSTEM_PROMPT,
                       judge_options: { llm_provider: 'typesafe_jev' })

      get edit_ai_judge_url(ai_judge)

      assert_response :success
      assert_select '#system-prompt-warning:not([style*="display:none"])'
      assert_select '#system-prompt-warning button', text: /Use TypeSafe Jev's default/
    end

    test 'says nothing when the instructions already belong to this provider' do
      ai_judge.update!(system_prompt: LlmProviders::JEV_SYSTEM_PROMPT,
                       judge_options: { llm_provider: 'typesafe_jev' })

      get edit_ai_judge_url(ai_judge)

      assert_response :success
      assert_select '#system-prompt-warning[style*="display:none"]'
    end

    test 'says nothing about a prompt somebody wrote themselves' do
      ai_judge.update!(system_prompt: 'Only rate wine labels.',
                       judge_options: { llm_provider: 'typesafe_jev' })

      get edit_ai_judge_url(ai_judge)

      assert_response :success
      assert_select '#system-prompt-warning[style*="display:none"]'
    end

    test 'shows the book scale as the criteria a typed model will be sent' do
      ai_judge.update!(judge_options: { llm_provider: 'typesafe_jev' })

      get edit_ai_judge_url(ai_judge, book_id: book.id)

      assert_response :success
      assert_select '#judging-criteria [data-ai-judge-wizard-target=criteriaTable]:not([style*="display:none"])',
                    text: /Criteria sent with the question/
      assert_select '#judging-criteria td', text: /Not Relevant/
      assert_select '#judging-criteria td', text: /level 1 . rating 1/
    end

    test 'shows a chat judge the scale as the prose its prompt will carry' do
      get edit_ai_judge_url(ai_judge, book_id: book.id)

      assert_response :success
      assert_select '#judging-criteria [data-ai-judge-wizard-target=criteriaProse]:not([style*="display:none"])',
                    text: /Rating scale added to the prompt/
      assert_select '#judging-criteria p', text: /0 \(labeled "Not Relevant"\)/
    end

    test 'a judge that needs a book cannot be run without one, and says where to go' do
      ai_judge.update!(judge_options: { llm_provider: 'typesafe_jev' })

      get edit_ai_judge_url(ai_judge)

      assert_response :success
      assert_select '[data-ai-judge-wizard-target=runPromptButton][disabled]'
      assert_select '[data-ai-judge-wizard-target=needsBookNotice]:not([style*="display:none"])',
                    text: /Judgement Stats/
    end

    test 'a judge that needs a book can be run once it has one' do
      ai_judge.update!(judge_options: { llm_provider: 'typesafe_jev' })

      get edit_ai_judge_url(ai_judge, book_id: book.id)

      assert_response :success
      assert_select '[data-ai-judge-wizard-target=runPromptButton][disabled]', count: 0
      assert_select '[data-ai-judge-wizard-target=needsBookNotice][style*="display:none"]'
    end

    test 'shows no criteria when there is no book to take them from' do
      get edit_ai_judge_url(ai_judge)

      assert_response :success
      assert_select '#judging-criteria', count: 0
    end
  end

  test 'should destroy ai_judge' do
    assert_difference('User.count', -1) do
      delete ai_judge_url(id: ai_judge.id)
    end

    assert_redirected_to ai_judges_url
  end

  describe 'index' do
    it 'lists AI judges the user owns or shares a team with' do
      owned_judge = AiJudge.create!(name: 'My Judge', llm_key: '1234', owner: user)

      get ai_judges_url

      assert_response :success
      assert_includes assigns(:ai_judges), owned_judge
      assert_includes assigns(:ai_judges), ai_judge
    end

    it 'excludes AI judges owned by, or only shared with, someone else' do
      other_user = users(:doug)
      private_judge = AiJudge.create!(name: 'Not Mine', llm_key: '1234', owner: other_user)

      get ai_judges_url

      assert_not_includes assigns(:ai_judges), private_judge
    end
  end

  describe 'access control' do
    it 'cannot edit an AI judge owned by, and not shared with, another user' do
      other_user = users(:doug)
      private_judge = AiJudge.create!(name: 'Not Mine', llm_key: '1234', owner: other_user)

      get edit_ai_judge_url(private_judge)

      assert_response :not_found
    end
  end

  describe 'cloning an ai_judge' do
    test 'renders a pre-filled form without creating a record' do
      assert_no_difference('User.count') do
        get clone_team_ai_judge_url(team_id: team.id, id: ai_judge.id)
      end

      assert_response :success
      assert_select "input[name='user[name]'][value=?]", "Clone of #{ai_judge.name}"
    end

    test 'submitting the cloned form creates a new ai_judge with the same settings' do
      get clone_team_ai_judge_url(team_id: team.id, id: ai_judge.id)

      assert_difference('User.count') do
        post team_ai_judges_url(team_id: team.id),
             params: { user: {
               name: "Clone of #{ai_judge.name}", llm_key: ai_judge.llm_key, system_prompt: ai_judge.system_prompt
             } }
      end

      clone = User.order(:id).last
      assert_equal "Clone of #{ai_judge.name}", clone.name
      assert_equal ai_judge.llm_key, clone.llm_key
      assert_predicate clone, :ai_judge?
    end

    test 'returns not found for an ai_judge id that does not belong to the team' do
      other_team_ai_judge = users(:matt)

      get clone_team_ai_judge_url(team_id: team.id, id: other_team_ai_judge.id)

      assert_response :not_found
    end
  end
end
