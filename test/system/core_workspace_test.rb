# frozen_string_literal: true

require 'controllers/application_system_test_case'

# E2E tests for the core case/try workspace.
# The case/try URL is served by Rails CoreController#show (modern stack). Legacy Angular
# UI tests are skipped until reimplemented for Stimulus/ViewComponents.
# See docs/angular_test_coverage_and_migration.md and
# docs/angular_to_stimulus_hotwire_viewcomponents_checklist.md.
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
    skip 'Angular UI; reimplement for Stimulus/ViewComponents when query UI is migrated'
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
    assert_selector '.results-score, .case-score', wait: 5
  end

  test 'open export modal' do
    skip 'Angular UI; reimplement for Stimulus/ViewComponents when export UI is migrated'
    sign_in_user
    visit case_core_path(@case, @try.try_number)
    wait_for_workspace_to_load

    click_link 'Export'
    assert_selector '.modal-title', text: /Export Case:/, wait: 5
  end

  test 'open clone modal' do
    skip 'Angular UI; reimplement for Stimulus/ViewComponents when clone UI is migrated'
    sign_in_user
    visit case_core_path(@case, @try.try_number)
    wait_for_workspace_to_load

    click_link 'Clone'
    assert_selector '.modal-title', text: /Clone case:/, wait: 5
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
    # Legacy: Angular case header. Modern stack uses #main-content and .core-workspace.
    assert_selector '#case-header', wait: 15
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
      response: {
        numFound: 10,
        start: 0,
        docs: [
          { id: 'doc1', title: 'First doc' },
          { id: 'doc2', title: 'Second doc' }
        ]
      }
    }.to_json
  end
end
