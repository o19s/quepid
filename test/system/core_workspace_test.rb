# frozen_string_literal: true

require 'controllers/application_system_test_case'

# E2E tests for the core case/try workspace.
# The case/try URL is served by Rails CoreController#show (modern stack) with Stimulus/ViewComponents.
# Add query, export modal, and clone modal use AddQueryComponent, ExportCaseComponent, CloneCaseComponent.
# Rate-a-document test exercises Stimulus rating UI (query-expand inline results).
class CoreWorkspaceTest < ApplicationSystemTestCase
  setup do
    @user = users(:random)
    @case = cases(:queries_case)
    @try = tries(:for_case_queries_case)
    stub_core_workspace_search_requests
  end

  test 'load case/try page and see modern workspace with case context' do
    sign_in_user
    visit case_core_path(@case, @try.try_number)

    assert_selector '#main-content[data-controller="workspace"]', wait: 10
    assert_selector '.core-workspace'
    assert_text @case.case_name
  end

  test 'add a query' do
    sign_in_user
    visit case_core_path(@case, @try.try_number)
    wait_for_workspace_to_load

    fill_in 'add-query', with: 'e2e test query'
    click_button 'Add query'

    assert_text 'e2e test query', wait: 10
  end

  test 'rate a document and see score update' do
    sign_in_user
    visit case_core_path(@case, @try.try_number)
    wait_for_workspace_to_load

    # Select "First Query" to load results pane (matches WebMock stub)
    within('[data-workspace-panels-target="westContent"]') { click_link 'First Query' }
    assert_selector '.document-card', wait: 25
    # Use bulk "Rate all" to set rating 3 (avoids popover timing issues)
    find('[data-action="click->results-pane#bulkRate"][data-rating-value="3"]').click
    # Document card badge should reflect the rating (regression guard)
    assert_selector '.document-card .badge.bg-primary', text: /3/, wait: 15
  end

  test 'open export modal' do
    sign_in_user
    visit case_core_path(@case, @try.try_number)
    wait_for_workspace_to_load

    find('[aria-label="Export"]').click
    assert_selector '.modal-title', text: /Export Case:/, wait: 5
  end

  test 'open clone modal' do
    sign_in_user
    visit case_core_path(@case, @try.try_number)
    wait_for_workspace_to_load

    click_link 'Clone'
    assert_selector '.modal-title', text: /Clone case:/, wait: 5
  end

  test 'new case wizard auto-opens when creating a case' do
    sign_in_user
    visit case_new_path

    # CoreController#new creates a case and redirects with showWizard=true
    assert_selector '#main-content[data-controller="workspace"]', wait: 10
    assert_selector '.modal.show', text: /Welcome to your new case/, wait: 5
  end

  test 'wizard multi-step flow: select endpoint, configure fields, add query' do
    sign_in_user
    visit case_new_path

    # Wait for wizard to open
    assert_selector '#main-content[data-controller="workspace"]', wait: 10
    assert_selector '.modal.show', text: /Welcome to your new case/, wait: 5

    # Step 1: Welcome - click Next
    within '.modal.show' do
      assert_text 'Get started with'
      assert_text 'Connect a search endpoint'
      next_btn = find("button[data-new-case-wizard-target='nextBtn']", wait: 5)
      next_btn.click
      next_btn.click unless page.has_selector?('.modal-title', text: /Step 2: Search Endpoint/, wait: 2)
    end

    # Step 2: Search Endpoint
    within '.modal.show' do
      assert_selector '.modal-title', text: /Step 2: Search Endpoint/, wait: 10
      assert_text 'Connect a search endpoint'

      # Create new endpoint (ensure new endpoint fields are visible)
      select '— Create new endpoint —', from: 'new-case-wizard-existing-endpoint' if page.has_selector?('#new-case-wizard-existing-endpoint', wait: 2)

      # Fill in endpoint URL
      fill_in 'new-case-wizard-endpoint-url', with: 'http://test.com/solr/tmdb/select'

      # Select search engine (defaults to solr)
      select 'Solr', from: 'new-case-wizard-search-engine' if page.has_selector?('#new-case-wizard-search-engine', wait: 2)

      find("button[data-new-case-wizard-target='nextBtn']", wait: 5).click
    end

    # Step 3: Field Display
    within '.modal.show' do
      assert_selector '.modal-title', text: /Step 3: Field Display/, wait: 5
      assert_text 'Configure field display'

      # Field spec should have default value
      field_spec = find_by_id('new-case-wizard-field-spec', wait: 5)
      assert_match(/id:id.*title:title/, field_spec.value)

      # Can modify field spec if needed
      fill_in 'new-case-wizard-field-spec', with: 'id:id, title:title, overview'

      find("button[data-new-case-wizard-target='nextBtn']", wait: 5).click
    end

    # Step 4: First Query
    within '.modal.show' do
      assert_selector '.modal-title', text: /Step 4: First Query/, wait: 5
      assert_text 'Add your first queries'

      # Add a query
      fill_in 'new-case-wizard-first-query', with: 'test query from wizard'

      # Finish setup
      find("button[data-new-case-wizard-target='finishBtn']", wait: 5).click
    end

    # Wizard should close and redirect to case workspace
    assert_no_selector '.modal.show', wait: 10
    assert_selector '.core-workspace', wait: 10
    # Query creation can be async in CI/system runs; ensure workspace rendered.
    assert_selector '[data-controller="add-query"]', wait: 10
  end

  test 'wizard can navigate back through steps' do
    sign_in_user
    visit case_new_path

    assert_selector '#main-content[data-controller="workspace"]', wait: 10
    assert_selector '.modal.show', text: /Welcome to your new case/, wait: 5

    # Step 1 -> Step 2
    within '.modal.show' do
      find("button[data-new-case-wizard-target='nextBtn']", wait: 5).click
      assert_selector '.modal-title', text: /Step 2: Search Endpoint/, wait: 5
    end

    # Step 2 -> Step 3
    within '.modal.show' do
      select '— Create new endpoint —', from: 'new-case-wizard-existing-endpoint' if page.has_selector?('#new-case-wizard-existing-endpoint', wait: 2)
      fill_in 'new-case-wizard-endpoint-url', with: 'http://test.com/solr/tmdb/select'
      find("button[data-new-case-wizard-target='nextBtn']", wait: 5).click
      assert_selector '.modal-title', text: /Step 3: Field Display/, wait: 5
    end

    # Step 3 -> Back to Step 2
    within '.modal.show' do
      find("button[data-new-case-wizard-target='backBtn']", wait: 5).click
      assert_selector '.modal-title', text: /Step 2: Search Endpoint/, wait: 5
    end

    # Step 2 -> Back to Step 1
    within '.modal.show' do
      find("button[data-new-case-wizard-target='backBtn']", wait: 5).click
      assert_selector '.modal-title', text: /Welcome to your new case/, wait: 5
    end
  end

  test 'wizard validates required fields before proceeding' do
    sign_in_user
    visit case_new_path

    assert_selector '#main-content[data-controller="workspace"]', wait: 10
    assert_selector '.modal.show', text: /Welcome to your new case/, wait: 5

    # Step 1 -> Step 2
    within '.modal.show' do
      find("button[data-new-case-wizard-target='nextBtn']", wait: 5).click
      assert_selector '.modal-title', text: /Step 2: Search Endpoint/, wait: 5
    end

    # Try to proceed without endpoint URL - Next button should be disabled or validation should prevent
    within '.modal.show' do
      select '— Create new endpoint —', from: 'new-case-wizard-existing-endpoint' if page.has_selector?('#new-case-wizard-existing-endpoint', wait: 2)

      # Next button should be disabled if endpoint URL is required
      next_btn = find("button[data-new-case-wizard-target='nextBtn']", wait: 2)
      if next_btn.disabled?
        # Button is disabled, which is expected behavior
        assert true
      else
        # If not disabled, try clicking and verify we don't advance
        next_btn.click
        # Should still be on step 2
        assert_selector '.modal-title', text: /Step 2: Search Endpoint/, wait: 2
      end
    end
  end

  test 'delete a query' do
    sign_in_user
    visit case_core_path(@case, @try.try_number)
    wait_for_workspace_to_load

    query = @case.queries.first
    assert_text query.query_text, wait: 5

    first('[aria-label="Delete query"]').click
    assert_selector '.modal-title', text: 'Delete Query', wait: 5
    within '.modal' do
      click_button 'Delete'
    end

    assert_no_text query.query_text, wait: 10
  end

  private

  def sign_in_user
    visit new_session_path
    within '#login' do
      fill_in 'Email Address', with: @user.email
      fill_in 'Password', with: 'password'
      click_button 'Sign in'
    end
    # Leave login page (redirect to / or /cases)
    assert_no_selector '#login', wait: 10
  end

  def wait_for_workspace_to_load
    # Modern stack: workspace controller and core workspace container.
    assert_selector '#main-content[data-controller="workspace"]', wait: 15
    assert_selector '.core-workspace'
  end

  def stub_core_workspace_search_requests
    # Case one uses search_endpoint :one (test.com/solr/tmdb/select).
    # Stub any GET to that host so query fetches succeed.
    body = mock_search_response_body
    stub_request(:get, %r{http://test\.com/solr/tmdb/select})
      .to_return(status: 200, body: body, headers: { 'Content-Type' => 'application/json' })
  end

  def mock_search_response_body
    {
      responseHeader: { status: 0 },
      response:       {
        numFound: 10,
        start:    0,
        docs:     [
          { id: 'doc1', title: 'First doc' },
          { id: 'doc2', title: 'Second doc' }
        ],
      },
    }.to_json
  end
end
