# frozen_string_literal: true

require 'controllers/application_system_test_case'

# E2E tests for the core case/try workspace.
# The case/try URL is served by Rails CoreController#show (modern stack) with Stimulus/ViewComponents.
# Add query, export modal, and clone modal use AddQueryComponent, ExportCaseComponent, CloneCaseComponent.
# Rate-a-document test remains skipped until rating UI is migrated.
class CoreWorkspaceTest < ApplicationSystemTestCase
  setup do
    @user = users(:doug)
    @case = cases(:one)
    @try = tries(:one)
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
    skip 'Angular UI; reimplement for Stimulus/ViewComponents when rating UI is migrated'
    sign_in_user
    visit case_core_path(@case, @try.try_number)
    wait_for_workspace_to_load

    # Expand first query to show results (toggle)
    first('.toggleSign').click
    # Wait for search results to load
    assert_selector '.search-result', wait: 10
    # Open rating control (single-rating button) and pick a rating
    first('.single-rating .btn').click
    # Popover has rating numbers
    assert_selector '.ratingNums', wait: 5
    first('.ratingNum').click
    # Score area should reflect update (qscore-query or case score)
    assert_selector '.re', wait: 5
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
    fill_in 'Email Address', with: @user.email
    fill_in 'Password', with: 'password'
    click_button 'Sign in'
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
