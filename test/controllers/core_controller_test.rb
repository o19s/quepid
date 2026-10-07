# frozen_string_literal: true

require 'test_helper'

class CoreControllerTest < ActionController::TestCase
  before do
    @controller = CoreController.new
  end

  describe 'Basic functionality' do
    before do
      login_user users(:doug)
    end

    test 'should get index' do
      get :index
      assert_response :success
    end

    test 'preserves the case shell and exclusive asset entries' do
      get :index, params: { id: cases(:one).id, try_number: tries(:one).try_number }

      assert_response :success
      assert_select 'body[data-controller="snapshot-bridge core-bootstrap query-command-bridge"]'
      assert_select 'body[data-core-bootstrap-case-no-value=?]', cases(:one).id.to_s
      assert_select 'body[data-core-bootstrap-try-no-value=?]', tries(:one).try_number.to_s
      assert_select 'body[data-core-bootstrap-case-toolbar-outlet="#case-actions"]'
      assert_select '#pickScorerModal[data-pick-scorer-core-communal-scorers-only-value=?]', Rails.application.config.communal_scorers_only.to_s
      assert_select '[data-queries-list-query-list-sortable-value=?]', Rails.application.config.query_list_sortable.to_s
      assert_select 'body[data-quepid-root-url]'
      assert_select 'head base', 1
      assert_select 'meta[name="turbo-visit-control"][content="reload"]', 1
      assert_select 'body.d-flex', 0
      assert_select '#main-content .pane_main footer', 1
      assert_select '.sidebar', 0
      assert_select 'body > #shareCaseModal', 1
      assert_select 'link[rel="stylesheet"]' do |links|
        hrefs = links.map { |link| link['href'] }
        assert(hrefs.any? { |href| href.match?(%r{/core[.-]}) })
        assert(hrefs.any? { |href| href.match?(%r{/json-explorer[.-]}) })
        assert_not(hrefs.any? { |href| href.match?(%r{/application[.-]}) })
      end
      scripts = css_select('script[src]').map { |script| script['src'] }
      entries = scripts.filter_map { |src| src[%r{/(core_vendor|core_case|tour)[.-]}, 1] }
      assert_equal %w[core_vendor core_case tour], entries
      assert_select 'script[type="module"]', text: /import "vega_globals"/
      assert_select 'script[type="module"]', text: /import "bootstrap_globals"/
      assert_select 'script[type="module"]', text: /import "application"/, count: 0
    end

    test 'preserves case navigation actions and book creation context' do
      kase = cases(:one)
      kase.teams << teams(:valid)
      kase.update!(scorer: scorers(:default_scorer))

      get :index, params: { id: kase.id }

      assert_response :success
      assert_select '#coreNavbarContent'
      assert_select '#header turbo-frame#dropdown_cases[src=?][loading="lazy"]', dropdown_cases_core_path
      assert_select '#header turbo-frame#dropdown_books[src=?][loading="lazy"]', dropdown_books_core_path
      assert_select '#header a[href=?] small', cases_path,
                    text: "(#{users(:doug).cases_involved_with.not_archived.count} active)"
      assert_select '#header a[href=?] small', books_path,
                    text: "(#{users(:doug).books_involved_with.count} active)"
      assert_select '#header button[data-action="click->wizard-launcher#newCase"][data-wizard-launcher-create-url-value=?]',
                    case_new_path.delete_prefix('/')
      assert_select '#header a[href=?]', new_book_path(scorer_id: kase.scorer_id, team_ids: [ teams(:valid).id ], origin_case_id: kase.id)
      assert_select '#header a[href=?]', teams_path
      assert_select '#header a[href=?]', scorers_path
      assert_select '#header a[href=?][target="_blank"][rel="noopener noreferrer"]', "#{root_path}notebooks/lab/index.html"
      assert_select '#header #case-header', 0
      assert_select '#main-content #case-header', 1
    end

    test 'preserves case footer links inside the workspace pane' do
      get :index, params: { id: cases(:one).id }

      assert_select 'body > footer', 0
      assert_select '.pane_main footer.pt-4.pb-4', 1
      assert_select '.pane_main footer a[href="http://opensourceconnections.com"]' do |links|
        assert_nil links.first['target']
      end
      assert_select '.pane_main footer a[href=?][target="_blank"]', oas_rails_path
      assert_select '.pane_main footer a[href="http://www.opensourceconnections.com/slack"][rel="noopener noreferrer"]'
      assert_select '.pane_main footer', text: /For community support and discussion/
      assert_select '.pane_main footer code', text: Rails.application.config.quepid_version
    end

    test 'preserves configured policy links in the case footer' do
      config = Rails.application.config
      keys = [ :terms_and_conditions_url, :privacy_url, :cookies_url ]
      original_urls = keys.index_with { |key| config.public_send(key) }
      keys.each { |key| config.public_send("#{key}=", "https://example.test/#{key}") }

      get :index, params: { id: cases(:one).id }

      keys.each do |key|
        assert_select '.pane_main footer a[href=?][target="_blank"][rel="noopener noreferrer"]', "https://example.test/#{key}"
      end
    ensure
      original_urls.each { |key, url| config.public_send("#{key}=", url) }
    end

    test 'preserves an explicitly missing try in the body bootstrap data' do
      get :index, params: { id: cases(:one).id, try_number: 999_999 }

      assert_response :success
      assert_select 'body[data-core-bootstrap-try-no-value="999999"]'
    end

    test 'embeds authorized API data without graph scores or duplicate endpoint objects' do
      kase = cases(:one)
      get :index, params: { id: kase.id, try_number: tries(:one).try_number }

      data = JSON.parse(css_select('body').first['data-core-bootstrap-initial-value'])
      assert_equal users(:doug).id, data.dig('user', 'id')
      assert_equal users(:doug).completed_case_wizard, data.dig('user', 'completed_case_wizard')
      assert_equal kase.id, data.dig('case', 'case_id')
      assert_equal kase.tries.pluck(:try_number).sort, data.dig('case', 'tries').pluck('try_number').sort
      assert_not data['case'].key?('last_score')
      assert_not data['case'].key?('scores')
      initial_try = data.dig('case', 'tries').find { |item| item['try_number'] == tries(:one).try_number }
      assert_equal tries(:one).field_spec, initial_try['field_spec']
      assert_equal tries(:one).search_endpoint.endpoint_url, initial_try['search_url']
      assert_not initial_try.key?('search_endpoint')
      assert_includes response.headers['Cache-Control'], 'no-store'
      assert_includes response.headers['Cache-Control'], 'private'
    end

    test 'escapes initial data inside its attribute while retaining the original values' do
      name = %q[</script><script>alert("x")</script>&'<>]
      cases(:one).update!(case_name: name)
      get :index, params: { id: cases(:one).id }

      data = JSON.parse(css_select('body').first['data-core-bootstrap-initial-value'])
      assert_equal name, data.dig('case', 'case_name')
      assert_select 'script', text: 'alert("x")', count: 0
    end

    test 'renders the base URL for sub-path deployments' do
      original_root = ENV.fetch('RAILS_RELATIVE_URL_ROOT', nil)
      ENV['RAILS_RELATIVE_URL_ROOT'] = '/quepid'

      get :index, params: { id: cases(:one).id }

      assert_select 'head base[href="/quepid/"]', 1
    ensure
      ENV['RAILS_RELATIVE_URL_ROOT'] = original_root
    end

    test 'creates a case and redirects to its first try when starting a new case' do
      assert_difference 'Case.count', 1 do
        get :new
      end

      created_case = Case.order(:id).last
      assert_redirected_to case_core_path(created_case, created_case.tries.first.try_number, params: { showWizard: true })
    end

    test 'loads the requested case and try' do
      kase = cases(:one)
      current_try = tries(:one)

      get :index, params: { id: kase.id, try_number: current_try.try_number }

      assert_response :success
      assert_equal kase, assigns(:case)
      assert_equal current_try, assigns(:try)
    end

    test 'renders the client-side templates and server-owned URL templates the case page needs' do
      kase = cases(:one)

      get :index, params: { id: kase.id, try_number: tries(:one).try_number }

      assert_response :success
      %w[rowTemplate searchResultsTemplate paginationTemplate diffScoreTemplate].each do |name|
        assert_select "#query-container template[data-queries-list-target='#{name}']", 1
      end
      assert_select "template[data-annotations-target='itemTemplate']", 1
      assert_select "#diffModal template[data-diff-core-target='selectionTemplate']", 1
      %w[shareableTeamTemplate sharedTeamTemplate].each do |name|
        assert_select "#shareCaseModal template[data-share-case-core-target='#{name}']", 1
      end
      assert_select "#pickScorerModal template[data-pick-scorer-core-target='itemTemplate']", 1
      %w[noneTemplate bookTemplate].each do |name|
        assert_select "#judgementsModal template[data-judgements-core-target='#{name}']", 1
      end
      assert_select '#judgementsModal[data-judgements-core-book-url-template-value=?]',
                    book_path(id: '__BOOK_ID__', script_name: '').delete_prefix('/')
      assert_select '#query-container[data-queries-list-query-url-template-value=?]',
                    "/api/cases/#{kase.id}/queries/__QUERY_ID__"
      assert_select '#query-container[data-queries-list-notes-url-template-value=?]',
                    "/api/cases/#{kase.id}/queries/__QUERY_ID__/notes"
      assert_select '#query-container[data-queries-list-position-url-template-value=?]',
                    "/api/cases/#{kase.id}/queries/__QUERY_ID__/position"
      assert_select '#queryOptionsModal[data-query-options-core-save-url-template-value=?]',
                    "/api/cases/#{kase.id}/queries/__QUERY_ID__/options"
      assert_select '#moveQueryModal[data-move-query-core-case-id-value=?]', kase.id.to_s
      assert_select '[data-annotations-url-value=?]', "/api/cases/#{kase.id}/annotations"
      assert_select '[data-frog-report-refresh-url-template-value*=?]', "/cases/#{kase.id}/"
      assert_select 'template#search-result-template', 1
      assert_select 'body[data-snapshot-bridge-snapshots-url-value=?]', "/api/cases/#{kase.id}/snapshots"
      assert_select '#wizardModal[data-wizard-snapshot-search-url-template-value=?]',
                    "http://test.host/api/cases/#{kase.id}/snapshots/__SNAPSHOT_ID__/search"
    end

    test 'renames a case and updates its search endpoint settings' do
      kase = cases(:one)
      current_try = tries(:one)

      get :index, params: {
        id:                  kase.id,
        try_number:          current_try.try_number,
        caseName:            'Renamed from core',
        searchEngine:        'solr',
        searchUrl:           'https://search.example.test/solr',
        apiMethod:           'GET',
        basicAuthCredential: '',
        fieldSpec:           'id:id title:title',
      }

      assert_response :success
      assert_equal 'Renamed from core', kase.reload.case_name
      assert_equal 'solr', current_try.reload.search_endpoint.search_engine
      assert_equal 'https://search.example.test/solr', current_try.search_endpoint.endpoint_url
      assert_equal 'GET', current_try.search_endpoint.api_method
      assert_equal '', current_try.search_endpoint.basic_auth_credential
      assert_equal 'id:id title:title', current_try.field_spec
    end

    test 'returns not found for an inaccessible case without creating one' do
      assert_no_difference 'Case.count' do
        get :index, params: { id: cases(:not_shared).id }
      end

      assert_response :not_found
    end

    test 'returns not found for a missing case without creating one' do
      assert_no_difference 'Case.count' do
        get :index, params: { id: 0 }
      end

      assert_response :not_found
    end

    test 'bootstraps a new case when no id is given and the user has no cases' do
      user = User.create!(name: 'No Cases', email: 'no_cases@example.com', password: 'password', agreed: true)
      login_user user

      assert_no_difference 'Case.count' do
        get :index
      end

      assert_redirected_to case_new_path
    end
  end
end
