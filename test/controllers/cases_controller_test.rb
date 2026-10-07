# frozen_string_literal: true

require 'test_helper'

class CasesControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }

  setup do
    login_user_for_integration_test user
  end

  test 'index renders body with data-quepid-root-url for Stimulus navigation' do
    Bullet.enable = false
    get cases_url
    Bullet.enable = true

    assert_response :success
    expected_root = root_url.chomp('/')
    assert_select 'body[data-quepid-root-url=?]', expected_root
    assert_select '[data-controller="import-case"]#importCaseModal'
    assert_select '#importSnapshotModal[data-import-snapshot-imports-url-template-value=?]',
                  '/api/cases/__CASE_ID__/snapshots/imports'
  end

  test 'preserves the management shell and exclusive asset entry under a base URL' do
    original_root = ENV.fetch('RAILS_RELATIVE_URL_ROOT', nil)
    ENV['RAILS_RELATIVE_URL_ROOT'] = '/quepid'
    Bullet.enable = false
    get cases_url

    assert_response :success
    assert_select 'head base[href="/quepid/"]', 1
    assert_select 'body.d-flex.flex-column.min-vh-100', 1
    assert_select '.container-fluid .row .sidebar', 1
    assert_select 'main.col-md-10', 1
    assert_select 'body > footer', 1
    assert_select 'body[data-core-bootstrap-case-no-value]', 0
    assert_select '#main-content', 0
    assert_select 'link[rel="stylesheet"]' do |links|
      hrefs = links.map { |link| link['href'] }
      assert(hrefs.any? { |href| href.match?(%r{/application[.-]}) })
      assert_not(hrefs.any? { |href| href.match?(%r{/(core|json-explorer)[.-]}) })
    end
    assert_select 'script[type="module"]', text: /import "application"/
    assert_not(css_select('script[src]').any? { |script| script['src'].match?(%r{/(core_case|core_vendor|tour)[.-]}) })
  ensure
    ENV['RAILS_RELATIVE_URL_ROOT'] = original_root
    Bullet.enable = true
  end

  test 'preserves management navigation and footer without case context' do
    Bullet.enable = false
    get cases_url

    assert_response :success
    assert_select 'nav #navbarSupportedContent'
    assert_select 'nav turbo-frame#dropdown_cases[src=?][loading="lazy"]', dropdown_cases_path
    assert_select 'nav turbo-frame#dropdown_books[src=?][loading="lazy"]', dropdown_books_path
    assert_select 'nav a[href=?]', case_new_path
    assert_select 'nav a[href=?]', cases_path
    assert_select 'nav a[href=?]', new_book_path
    assert_select 'nav a[href*="origin_case_id"]', 0
    assert_select 'nav small', 0
    assert_select 'nav [data-controller="wizard-launcher"]', 0
    assert_select 'nav a[href=?]', teams_path
    assert_select 'nav a[href=?]', scorers_path
    assert_select 'nav a[href=?][target="_blank"][rel="noopener noreferrer"]', "#{root_path}notebooks/lab/index.html"
    assert_select 'body > footer.mt-auto.bg-body-tertiary', 1
    assert_select 'footer a[href="http://opensourceconnections.com"][target="_blank"][rel="noopener noreferrer"]'
    assert_select 'footer code', text: Rails.application.config.quepid_version
    assert_select 'footer a[href=?]', oas_rails_path
  ensure
    Bullet.enable = true
  end

  test 'destroy permanently deletes a case the user owns and redirects to the cases listing' do
    kase = cases(:queries_case)

    Bullet.enable = false
    assert_difference('Case.count', -1) do
      delete case_url(kase)
    end
    Bullet.enable = true

    assert_redirected_to cases_path
    assert_nil Case.find_by(id: kase.id)
  end

  test 'destroy does not delete a case the user is not involved with' do
    kase = cases(:owned_case)

    assert_no_difference('Case.count') do
      delete case_url(kase)
    end

    assert_redirected_to cases_path
    assert_not_nil Case.find_by(id: kase.id)
  end

  test 'destroy_queries deletes all queries for the case but keeps the case' do
    kase = cases(:queries_case)

    Bullet.enable = false
    assert_difference('kase.queries.count', -kase.queries.count) do
      delete case_queries_url(kase)
    end
    Bullet.enable = true

    assert_redirected_to case_core_path(id: kase.id, try_number: kase.last_try_number)
    assert_not_nil Case.find_by(id: kase.id)
  end

  test 'destroy_queries does not delete queries for a case the user is not involved with' do
    kase = cases(:owned_case)

    delete case_queries_url(kase)

    assert_redirected_to cases_path
  end

  test 'archive marks a case the user owns as archived and redirects to the cases listing' do
    kase = cases(:queries_case)

    post archive_case_url(kase)

    assert_redirected_to cases_path
    assert kase.reload.archived
    assert_equal user, kase.owner
  end

  test 'archive does not archive a case the user is not involved with' do
    kase = cases(:owned_case)

    post archive_case_url(kase)

    assert_redirected_to cases_path
    assert_not kase.reload.archived
  end

  test 'unarchive restores a case the user owns and redirects to the cases listing' do
    kase = cases(:queries_case)
    kase.mark_archived!

    post unarchive_case_url(kase)

    assert_redirected_to cases_path
    assert_not kase.reload.archived
  end

  test 'unarchive does not touch a case the user is not involved with' do
    kase = cases(:owned_case)
    kase.mark_archived!

    post unarchive_case_url(kase)

    assert_redirected_to cases_path
    assert kase.reload.archived
  end
end
