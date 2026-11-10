# frozen_string_literal: true

require 'test_helper'

class AiJudgesControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  # On a connection: a judge from before connections can't be saved until it is moved onto one.
  let(:ai_judge) { users(:judge_judy).tap { |judge| judge.update_column(:connection_id, connections(:openai).id) } }
  let(:legacy_judge) { users(:judge_judy) }
  let(:team) { teams(:shared) }
  let(:random_openai) do
    Connection.create!(name: 'Random OpenAI', provider: 'openai', base_url: 'https://api.openai.com',
                       auth_scheme: 'bearer', secret: '1234asdf5678', owner: users(:random))
  end
  let(:random_jev) do
    Connection.create!(name: 'Random Jev', provider: 'typesafe_jev', base_url: 'https://api.typesafe.ai',
                       auth_scheme: 'bearer', secret: 'abc123', owner: users(:random))
  end

  setup do
    login_user_for_integration_test user
  end

  test 'clone opens an unsaved owned configuration with only the originating team' do
    ai_judge.update!(administrator: true, company: 'Do not copy', reset_password_token: 'source-token')
    assert_no_difference 'User.count' do
      get clone_team_ai_judge_url(team_id: team.id, id: ai_judge.id)
    end
    assert_response :success
    assert_select 'form[action=?]', team_ai_judges_path(team)
    assert_select 'input[name="user[name]"][value=?]', "Clone of #{ai_judge.name}"
    # A copy never takes the original's key or connection: the cloner picks one of theirs.
    assert_select 'input[name="user[llm_key]"]', count: 0
    assert_select 'select[name="user[connection_id]"] option[selected]', count: 0
    assert_includes response.body, 'Connection is required: choose one of your connections for this copy'
    assert_select 'input[name="user[team_ids][]"][checked][value=?]', team.id.to_s
    assert_select '[data-ai-judge-wizard-existing-value="false"]'
    assert_select '[data-ai-judge-wizard-test-url-value*="/new/"]'
  end

  test 'saving a clone creates a distinct requester-owned judge without account state' do
    configuration = { name: "Clone of #{ai_judge.name}", connection_id: random_openai.id,
                      system_prompt: ai_judge.system_prompt, options: { judge_options: ai_judge.judge_options }.to_json,
                      team_ids: [ team.id ], administrator: true, reset_password_token: 'source-token' }
    original = ai_judge.attributes
    assert_difference 'AiJudge.count' do
      post team_ai_judges_url(team), params: { user: configuration }
    end
    assert_response :see_other
    assert_redirected_to team_url(team)
    cloned = AiJudge.order(:id).last
    assert_equal user, cloned.owner
    assert_equal random_openai, cloned.connection
    assert_nil cloned.llm_key
    assert_equal ai_judge.system_prompt, cloned.system_prompt
    assert_equal ai_judge.judge_options.except(:llm_service_url, :llm_timeout).merge(llm_provider: 'openai'), cloned.judge_options
    assert_equal [ team.id ], cloned.team_ids
    assert_not cloned.administrator?
    assert_nil cloned.reset_password_token
    assert_empty cloned.books
    assert_equal original, ai_judge.reload.attributes
  end

  test 'clone rejects an inaccessible team, private source, and source outside the team' do
    get clone_team_ai_judge_url(team_id: teams(:valid).id, id: ai_judge.id)
    assert_response :not_found
    ai_judge.teams.clear
    get clone_team_ai_judge_url(team_id: team.id, id: ai_judge.id)
    assert_response :not_found
    ai_judge.update!(owner: user)
    get clone_team_ai_judge_url(team_id: team.id, id: ai_judge.id)
    assert_response :not_found
  end

  test 'clone validation failure retains input and the nested create route for retry' do
    assert_no_difference 'User.count' do
      post team_ai_judges_url(team), params: { user: {
        name: 'Retry clone', connection_id: random_openai.id, system_prompt: '', options: '{broken', team_ids: [ team.id ]
      } }
    end
    assert_response :unprocessable_content
    assert_select 'form[action=?]', team_ai_judges_path(team)
    assert_select 'input[name="user[name]"][value="Retry clone"]'
    assert_select 'select[name="user[connection_id]"] option[selected][value=?]', random_openai.id.to_s
    assert_select 'textarea[name="user[options]"]', text: '{broken'
    assert_select 'input[name="user[team_ids][]"][checked][value=?]', team.id.to_s
  end

  test 'update announces success and retains the team-context redirect' do
    patch team_ai_judge_url(team, ai_judge), params: { user: { name: 'Updated judge' } }
    assert_response :see_other
    assert_redirected_to team_url(team)
    assert_equal 'AI Judge was successfully updated.', flash[:notice]
  end

  test 'should get new with the existing provider defaults' do
    get new_team_ai_judge_url(team_id: team.id)
    assert_response :success
    # The provider waits for a connection.
    assert_select '#judge_options_llm_provider option[selected]', count: 0
    # The URL and timeout belong to the connection now.
    assert_select '#judge_options_llm_service_url', count: 0
    assert_select '#judge_options_llm_model[value="gpt-4o"]'
    assert_select '#judge_options_llm_timeout', count: 0
    assert_select '#judge_options_llm_api_version[value=""]'
    assert_select 'textarea[name="user[system_prompt]"]', text: LlmProvider::CHAT_SYSTEM_PROMPT
  end

  test 'should get new with a team pre-selected from the team page' do
    get new_ai_judge_url(team_id: team.id)
    assert_response :success
    assert_equal [ team.id ], assigns(:ai_judge).team_ids
    assert_select "input[type=checkbox][value='#{team.id}'][checked]"
  end

  test 'new renders the provider dropdown and presets from the LlmProvider registry' do
    get new_ai_judge_url

    LlmProvider.each do |provider|
      assert_select 'select#judge_options_llm_provider option[value=?]', provider.key, text: provider.label
    end
    form = css_select('[data-controller~="ai-judge-form"]').first
    presets_json = form['data-ai-judge-form-presets-value']

    assert_not_nil presets_json, 'presets were not rendered into the wizard'
    assert_equal LlmProvider.presets.deep_stringify_keys, JSON.parse(presets_json)
  end

  test 'should create ai_judge' do
    assert_difference('User.count') do
      post team_ai_judges_url(team_id: team.id),
           params: { user: {
             name: ai_judge.name, connection_id: random_openai.id, system_prompt: ai_judge.system_prompt
           } }
    end
    assert_redirected_to team_url(id: team.id)
  end

  test 'should create ai_judge with no team (owner-only)' do
    assert_difference('User.count') do
      post ai_judges_url,
           params: { user: {
             name: ai_judge.name, connection_id: random_openai.id, system_prompt: ai_judge.system_prompt
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
             name: ai_judge.name, connection_id: random_openai.id, system_prompt: ai_judge.system_prompt,
             team_ids: [ team.id ]
           } }
    end
    new_judge = User.order(:id).last
    assert_includes new_judge.teams, team
  end

  test 'should update ai_judge and flash a success notice' do
    patch ai_judge_url(ai_judge),
          params: { user: {
            name: 'Renamed Judge', system_prompt: ai_judge.system_prompt
          } }

    assert_redirected_to ai_judge_url(ai_judge)
    assert_equal 'AI Judge was successfully updated.', flash[:notice]
    assert_equal 'Renamed Judge', ai_judge.reload.name
  end

  test 'a validation failure on update keeps the book context the request arrived with' do
    book = books(:james_bond_movies)

    patch ai_judge_url(ai_judge), params: { book_id: book.id, user: { name: '' } }

    assert_response :unprocessable_content
    assert_select '[data-ai-judge-form-has-scale-value=true]'
  end

  test 'should destroy ai_judge' do
    assert_difference('User.count', -1) do
      delete team_ai_judge_url(team_id: team.id, id: ai_judge.id)
    end

    assert_redirected_to team_url(id: team.id)
  end

  test 'should destroy ai_judge without a team context' do
    assert_difference('User.count', -1) do
      delete ai_judge_url(id: ai_judge.id)
    end

    assert_redirected_to ai_judges_url
  end

  test 'says why a judge with judgements cannot be deleted' do
    ai_judge.update!(owner: user)
    books(:james_bond_movies).query_doc_pairs.first.judgements.create!(user: ai_judge, rating: 1)

    assert_no_difference('User.count') do
      delete ai_judge_url(id: ai_judge.id)
    end

    assert_redirected_to ai_judges_url
    assert_equal 'Could not delete AI Judge Judge Judy: Please reassign ownership of the 1 judgements.', flash[:alert]
  end

  test 'new offers the chat prompt, and ships every stock prompt for the switcher' do
    get new_ai_judge_url

    assert_select 'textarea[name=?]', 'user[system_prompt]', text: /scale of 0 to 3/

    stock = css_select('[data-controller~="ai-judge-form"]').first['data-ai-judge-form-stock-prompts-value']

    assert_not_nil stock, 'stock prompts were not rendered into the wizard'
    assert_equal LlmProvider.stock_system_prompts, JSON.parse(stock)
    defaults = JSON.parse(css_select('[data-controller~="ai-judge-form"]').first['data-ai-judge-form-option-defaults-value'])
    assert_equal LlmService::DEFAULT_OPTIONS.except(:llm_service_url, :llm_timeout).stringify_keys.merge('llm_provider' => 'openai', 'llm_api_version' => ''), defaults
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
           connection_id: random_jev.id,
           system_prompt: 'Judge this',
           judge_options: { llm_provider: 'typesafe_jev', jev_min_confidence: '0.4' },
         } }

    judge = AiJudge.order(:id).last

    assert_equal '0.4', judge.judge_options[:jev_min_confidence]
    assert_equal '0.4', judge.options.dig('judge_options', 'jev_min_confidence')
  end

  test 'new offers the include images switch, on' do
    get new_ai_judge_url

    assert_select 'input#judge_options_llm_include_images[type=checkbox][role=switch][checked]'
    assert_select 'input[type=hidden][name=?][value=?]', 'user[judge_options][llm_include_images]', 'false'
  end

  test 'edit shows the include images switch on for a judge saved before it existed' do
    assert_nil ai_judge.judge_options[:llm_include_images]

    get edit_ai_judge_url(ai_judge)

    assert_select 'input#judge_options_llm_include_images[checked]'
  end

  test 'turning include images off is stored with the judge' do
    patch ai_judge_url(ai_judge),
          params: { user: { judge_options: { llm_provider: 'ollama', llm_include_images: 'false' } } }

    assert_equal 'false', ai_judge.reload.judge_options[:llm_include_images]
  end

  test 'edit shows the include images switch off for a judge that turned it off' do
    ai_judge.update!(judge_options: ai_judge.judge_options.merge(llm_include_images: 'false'))

    get edit_ai_judge_url(ai_judge)

    assert_select 'input#judge_options_llm_include_images'
    assert_select 'input#judge_options_llm_include_images[checked]', count: 0
  end

  test 'edit shows the include images switch disabled for a provider that cannot take images' do
    legacy_judge.update!(judge_options: { llm_provider: 'ollama', llm_include_images: 'true' })

    get edit_ai_judge_url(legacy_judge)

    assert_select 'input#judge_options_llm_include_images[disabled]'
    assert_select 'input#judge_options_llm_include_images[checked]', count: 0
    # the judge's own choice still posts, kept for a provider that can
    assert_select 'input[type=hidden][name=?][value=?]', 'user[judge_options][llm_include_images]', 'true'
    # the "doesn't support images" explanation lives in Model Configuration
    # now (LlmProvider#to_preset[:help]), populated client-side from the
    # presets JSON rather than server-rendered inline under the switch.
    presets = JSON.parse(css_select('[data-controller~="ai-judge-form"]').first['data-ai-judge-form-presets-value'])
    assert_includes presets.dig('ollama', 'help'), "doesn't support images"
  end

  test 'new shows the include images switch enabled for the default provider' do
    get new_ai_judge_url

    assert_select 'input#judge_options_llm_include_images[disabled]', count: 0
    presets = JSON.parse(css_select('[data-controller~="ai-judge-form"]').first['data-ai-judge-form-presets-value'])
    assert_includes presets.dig('openai', 'help'), 'Attached as an image URL'
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
             connection_id: random_jev.id,
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

  test 'provider help preserves formatting and links while removing unsafe markup' do
    provider = LlmProvider.find('openai')
    provider.help_html = <<~HTML
      <strong onclick="alert(1)">Provider</strong><br><b>URL:</b><code>example</code>
      <a href="https://example.com/help" target="_blank" rel="noopener">Help</a>
      <a href="javascript:alert(1)">Unsafe link</a><img src="x" onerror="alert(1)">
    HTML

    template = File.readlines(Rails.root.join('app/views/ai_judges/_provider_options.html.erb')).find do |line|
      line.include?('entry.help_html')
    end
    html = ApplicationController.render(inline: template, locals: { entry: provider })

    assert_select Nokogiri::HTML5.fragment(html), 'template[data-provider="openai"]' do
      assert_select 'strong', text: 'Provider'
      assert_select 'br', count: 1
      assert_select 'b', text: 'URL:'
      assert_select 'code', text: 'example'
      assert_select 'a[href="https://example.com/help"][target="_blank"][rel="noopener"]', text: 'Help'
      assert_select 'a:not([href])', text: 'Unsafe link'
      assert_select 'img, [onclick], [onerror]', count: 0
    end
  end

  test 'a saved Jev judge renders a disabled preview without an accessible scale' do
    legacy_judge.update!(judge_options: { llm_provider: 'typesafe_jev' })
    get edit_ai_judge_url(legacy_judge)
    assert_response :success
    assert_select '[data-ai-judge-wizard-target=runPromptButton][disabled]'
    assert_select '[data-ai-judge-form-target=needsScaleNotice]:not([style*="display:none"])', text: /Judgement Stats/
    assert_select '#judge_options_llm_include_images[disabled]:not([checked])'
  end

  describe 'edit, as the page to refine a prompt on' do
    let(:book) { books(:james_bond_movies) }

    # Whether the "written for another provider" warning shows is computed
    # client-side (AiJudgeFormController#describePromptField) from data this
    # page renders - the warning's own markup always starts display:none, so
    # a non-JS integration test can't see it toggle. Covered at the unit
    # level instead (test/javascript/controllers/ai_judge_form_controller.test.js).

    test 'shows the book scale as the criteria a typed model will be sent' do
      legacy_judge.update!(judge_options: { llm_provider: 'typesafe_jev' })

      get edit_ai_judge_url(legacy_judge, book_id: book.id)

      assert_response :success
      assert_select '[data-ai-judge-form-target=criteriaTable]:not([style*="display:none"])',
                    text: /Criteria sent with the question/
      assert_select '[data-ai-judge-form-target=criteriaTable] td', text: /Not Relevant/
      assert_select '[data-ai-judge-form-target=criteriaTable] td', text: /level 1 . rating 1/
    end

    test 'shows a chat judge the scale as the prose its prompt will carry' do
      get edit_ai_judge_url(ai_judge, book_id: book.id)

      assert_response :success
      assert_select '[data-ai-judge-form-target=criteriaProse]:not([style*="display:none"])',
                    text: /Rating scale added to the prompt/
      assert_select '[data-ai-judge-form-target=criteriaProse] p', text: /0 \(labeled "Not Relevant"\)/
    end

    test 'a judge that needs a book cannot be run without one, and offers a scale picker instead' do
      legacy_judge.update!(judge_options: { llm_provider: 'typesafe_jev' })

      get edit_ai_judge_url(legacy_judge)

      assert_response :success
      assert_select '[data-ai-judge-wizard-target=runPromptButton][disabled]'
      assert_select '[data-ai-judge-form-target=needsScaleNotice]:not([style*="display:none"]) select'
      # a plain select navigated via each option's own data-url, not a <form> -
      # this whole partial already renders inside the page's outer judge-save
      # form_with, and a nested <form> here would silently submit THAT one
      # instead (see the view's comment).
      assert_select '[data-ai-judge-form-target=needsScaleNotice] form', count: 0
      assert_select '[data-ai-judge-form-target=needsScaleNotice] select option[data-url*="scorer_id="]',
                    minimum: 1
    end

    test 'the scale picker is deduplicated across every scorer the user has access to' do
      # fixtures random_scorer/random_scorer_1/random_scorer_2/case_default_scorer
      # all give user the same [1, 2, 3, 4] scale - a single option proves the
      # picker is unique, not one entry per scorer that shares it.
      ai_judge.update!(judge_options: { llm_provider: 'typesafe_jev' })

      get edit_ai_judge_url(ai_judge)

      options = css_select('[data-ai-judge-form-target=needsScaleNotice] select option').map(&:text)
      assert_equal(1, options.count { |text| text.include?('1,2,3,4') })
    end

    test 'a judge that needs a book can be run once it has one' do
      ai_judge.update!(judge_options: { llm_provider: 'typesafe_jev' })

      get edit_ai_judge_url(ai_judge, book_id: book.id)

      assert_response :success
      assert_select '[data-ai-judge-wizard-target=runPromptButton][disabled]', count: 0
      assert_select '[data-ai-judge-form-target=needsScaleNotice][style*="display:none"]'
    end

    test 'a judge that needs a book can also be run against a scorer picked without one' do
      legacy_judge.update!(judge_options: { llm_provider: 'typesafe_jev' })
      scorer = scorers(:random_scorer)

      get edit_ai_judge_url(legacy_judge, scorer_id: scorer.id)

      assert_response :success
      assert_select '[data-ai-judge-wizard-target=runPromptButton][disabled]', count: 0
      # Unlike the book case, the picker stays visible even once a scale is
      # set, so the user can switch to a different scorer.
      assert_select '[data-ai-judge-form-target=needsScaleNotice]:not([style*="display:none"]) select'
      assert_select '[data-ai-judge-form-target=criteriaTable]', text: /#{Regexp.escape(scorer.name)}/
    end

    test 'shows no criteria when there is no book to take them from' do
      get edit_ai_judge_url(ai_judge)

      assert_response :success
      assert_select '[data-ai-judge-form-target=criteriaTable]', count: 0
    end
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

  describe 'escalation' do
    let(:sleeper) { AiJudge.create!(name: 'Sleeper', owner: user) }

    it 'offers the judges the user can see, but not the judge itself' do
      sleeper
      private_judge = AiJudge.create!(name: 'Not Mine', owner: users(:doug))

      get edit_ai_judge_url(ai_judge)

      assert_select 'select#user_escalates_to_id option[value=?]', sleeper.id.to_s, text: 'Sleeper'
      assert_select 'select#user_escalates_to_id option[value=?]', ai_judge.id.to_s, count: 0
      assert_select 'select#user_escalates_to_id option[value=?]', private_judge.id.to_s, count: 0
    end

    it 'saves the judge to wake, and shows that judge as on call' do
      patch ai_judge_url(ai_judge), params: { user: { escalates_to_id: sleeper.id, team_ids: [ team.id ] } }

      assert_redirected_to ai_judge_url(ai_judge)
      assert_equal sleeper, ai_judge.reload.escalates_to

      get edit_ai_judge_url(sleeper)
      assert_select '#on-call-notice', text: /On call\s+for Judge Judy/

      get ai_judges_url
      assert_select 'td', text: /wakes Sleeper/
      assert_select '.badge', text: /On call/
    end

    it 'explains when a pair is handed on, including the confidence floor' do
      get edit_ai_judge_url(ai_judge)

      assert_select '#escalation-help li', 4
      assert_select '#escalation-help li', text: /Minimum Confidence/
    end

    it 'clears the judge to wake when Nobody is picked' do
      ai_judge.update!(escalates_to: sleeper)

      patch ai_judge_url(ai_judge), params: { user: { escalates_to_id: '' } }

      assert_nil ai_judge.reload.escalates_to_id
    end

    it 'refuses a judge the user cannot see' do
      private_judge = AiJudge.create!(name: 'Not Mine', owner: users(:doug))

      patch ai_judge_url(ai_judge), params: { user: { escalates_to_id: private_judge.id } }

      assert_response :unprocessable_content
      assert_nil ai_judge.reload.escalates_to_id
      assert_select 'li', text: /is not an AI judge you can use/
    end

    it 'keeps a target the user cannot see when saving something else' do
      private_judge = AiJudge.create!(name: 'Not Mine', owner: users(:doug))
      ai_judge.update!(escalates_to: private_judge)

      get edit_ai_judge_url(ai_judge)
      assert_select 'select#user_escalates_to_id option[selected][value=?]', private_judge.id.to_s

      patch ai_judge_url(ai_judge), params: { user: { name: 'Renamed', escalates_to_id: private_judge.id } }

      assert_redirected_to ai_judge_url(ai_judge)
      assert_equal private_judge, ai_judge.reload.escalates_to
    end

    it 'refuses a loop' do
      sleeper.update!(escalates_to: ai_judge)

      patch ai_judge_url(ai_judge), params: { user: { escalates_to_id: sleeper.id, team_ids: [ team.id ] } }

      assert_response :unprocessable_content
      assert_nil ai_judge.reload.escalates_to_id
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

  describe 'connections' do
    test 'a new judge needs a connection' do
      assert_no_difference 'AiJudge.count' do
        post ai_judges_url, params: { user: { name: 'No connection', system_prompt: 'Judge it.' } }
      end
      assert_response :unprocessable_content
      assert_includes response.body, 'Connection is required'
    end

    test 'a new judge cannot use a connection that is not yours' do
      assert_no_difference 'AiJudge.count' do
        post ai_judges_url, params: { user: { name: 'Borrowed', system_prompt: 'Judge it.', connection_id: connections(:openai).id } }
      end
      assert_response :unprocessable_content
      assert_includes response.body, 'Connection isn&#39;t one you can use'
    end

    test 'the form offers your connections that can judge, and says which have no key yet' do
      random_openai
      random_jev.update_column(:secret, nil)
      get new_ai_judge_url

      assert_select 'select[name="user[connection_id]"]' do
        assert_select 'option[value=?][data-provider="openai"]', random_openai.id.to_s
        assert_select 'option[value=?]', random_jev.id.to_s, text: /no key yet/
        assert_select 'option[value=?]', connections(:openai).id.to_s, count: 0
      end
    end

    test 'a judge with its own settings is told to move, and cannot be saved until it is on a connection' do
      get edit_ai_judge_url(legacy_judge)
      assert_select '#own-settings-notice'
      assert_select '.row:not(.d-none) #judge_options_llm_provider'
      assert_select '#llm_provider_help', text: /deprecated/
      assert_select 'input[type=hidden][name="user[judge_options][llm_service_url]"][value="https://api.openai.com"]'

      patch ai_judge_url(legacy_judge), params: { user: { name: 'Still own', judge_options: { llm_service_url: 'https://api.openai.com', llm_model: 'gpt-4o' } } }
      assert_response :unprocessable_content
      assert_includes response.body, 'migrate this judge to a new connection first'
      assert_not_equal 'Still own', legacy_judge.reload.name
      assert_equal '1234asdf5678', legacy_judge.llm_key
    end

    test 'the owner can migrate a judge with its own settings to a new connection holding them' do
      legacy = AiJudge.create!(name: 'Old Judge', system_prompt: 'Judge it.', owner: user, llm_key: 'own-key',
                               judge_options: { llm_service_url: 'https://own.example', llm_timeout: 45, llm_model: 'gpt-4o' })
      get edit_ai_judge_url(legacy)
      assert_select 'a[data-turbo-method="post"][href=?]', migrate_connection_ai_judge_path(legacy), text: 'Migrate to connection'

      assert_difference 'user.owned_connections.count', 1 do
        post migrate_connection_ai_judge_url(legacy)
      end
      assert_redirected_to edit_ai_judge_url(legacy)
      legacy.reload
      connection = legacy.connection
      assert_equal [ user, 'openai', 'https://own.example', 'own-key', 45 ],
                   [ connection.owner, connection.provider, connection.base_url, connection.secret, connection.timeout ]
      assert_nil legacy.llm_key
      assert_not_predicate legacy, :own_settings?
    end

    test 'migrating a judge with no owner makes it the migrating user\'s' do
      assert_nil legacy_judge.owner
      get edit_ai_judge_url(legacy_judge)
      assert_select 'a', text: 'Migrate to connection'

      post migrate_connection_ai_judge_url(legacy_judge)

      legacy_judge.reload
      assert_equal user, legacy_judge.owner
      assert_equal user, legacy_judge.connection.owner
      assert_equal '1234asdf5678', legacy_judge.connection.secret
    end

    test 'a teammate can migrate an owned judge, and the connection goes to its owner' do
      legacy = AiJudge.create!(name: 'Doug Judge', system_prompt: 'Judge it.', owner: users(:doug), llm_key: 'dougs-key',
                               judge_options: { llm_service_url: 'https://own.example', llm_model: 'gpt-4o' })
      legacy.teams << team
      get edit_ai_judge_url(legacy)
      assert_select '#own-settings-notice a', text: 'Migrate to connection'

      post migrate_connection_ai_judge_url(legacy)

      legacy.reload
      assert_equal users(:doug), legacy.owner
      assert_equal users(:doug), legacy.connection.owner
    end

    test 'a judge on a connection shows its provider read-only, without the deprecation note' do
      get edit_ai_judge_url(ai_judge)

      assert_select '.row:not(.d-none) #judge_options_llm_provider[aria-readonly=true]'
      assert_select '#llm_provider_help', count: 0
    end

    test 'a judge already on a connection has nothing to migrate' do
      assert_no_difference 'Connection.count' do
        post migrate_connection_ai_judge_url(ai_judge)
      end
      assert_equal 'This judge is already on a connection.', flash[:alert]
      get edit_ai_judge_url(ai_judge)
      assert_select 'a', text: 'Migrate to connection', count: 0
    end

    test 'a new judge has no provider until a connection is chosen' do
      get new_ai_judge_url

      assert_select '#judge_options_llm_provider option:first-child[value=""]', text: 'Choose a connection first'
      assert_select '#judge_options_llm_provider option[selected]', count: 0
      assert_select '.row.d-none #judge_options_llm_provider'
    end

    test 'opening the form gives a user without LLM connections one per provider' do
      login_user_for_integration_test users(:joey)
      users(:joey).owned_connections.delete_all

      get new_ai_judge_url

      assert_response :success
      assert users(:joey).owned_connections.exists?(provider: 'openai')
      assert_select 'select[name="user[connection_id]"] option', text: /OpenAI.*no key yet/
    end
  end
end
