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

  test 'index share modal loads each case into a frame that reports load failures' do
    Bullet.enable = false
    get cases_url
    Bullet.enable = true

    assert_response :success
    kase = user.cases_involved_with.where(archived: false).first
    assert_select 'button[data-bs-target="#shareCaseModal"][data-share-case-url-value=?]', share_modal_path('case', kase)
    assert_select '#shareCaseModal[data-controller="share-case"]' do
      assert_select 'turbo-frame#share-case-frame[target="_top"][data-share-case-target="frame"][data-action=?]',
                    'turbo:frame-missing->share-case#loadFailed turbo:fetch-request-error->share-case#loadFailed'
      assert_select 'template[data-share-case-target="loading"]'
      assert_select 'template[data-share-case-target="loadError"]'
    end
  end

  test 'preserves the management shell and exclusive asset entry under a base URL' do
    original_root = ENV.fetch('RAILS_RELATIVE_URL_ROOT', nil)
    ENV['RAILS_RELATIVE_URL_ROOT'] = '/quepid'
    Bullet.enable = false
    get cases_url

    assert_response :success
    assert_select 'head base[href="/quepid/"]', 1
    assert_select 'body.d-flex.flex-column.min-vh-100', 1
    assert_select '.container-fluid > .sidebar', 1
    assert_select '.container-fluid > main.flex-grow-1', 1
    assert_select 'body > footer', 1
    assert_select 'body[data-core-bootstrap-case-no-value]', 0
    assert_select '#main-content', 0
    assert_select 'link[rel="stylesheet"]' do |links|
      hrefs = links.map { |link| link['href'] }
      assert(hrefs.any? { |href| href.match?(%r{/application[.-]}) })
      assert_not(hrefs.any? { |href| href.match?(%r{/(core|json-explorer)[.-]}) })
    end
    assert_select 'script[type="module"]', text: /import "application"/
    assert_not(css_select('script[src]').any? { |script| script['src'].match?(%r{/(core_case)[.-]}) })
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

  test 'index loads only the latest score summary for displayed cases' do
    kase = cases(:other_score_case)
    kase.update!(owner: user)
    latest = scores(:score_with_queries)
    latest.update!(score: 98.765, user: user, updated_at: 1.day.from_now)
    loaded_scores = 0
    score_queries = []
    instantiation = lambda do |event|
      loaded_scores += event.payload[:record_count] if 'Score' == event.payload[:class_name]
    end
    sql = lambda do |event|
      statement = event.payload[:sql]
      score_queries << statement if statement.match?(/SELECT.*case_scores/i)
    end

    bullet_enabled = Bullet.enable?
    Bullet.enable = false
    ActiveSupport::Notifications.subscribed(instantiation, 'instantiation.active_record') do
      ActiveSupport::Notifications.subscribed(sql, 'sql.active_record') do
        get cases_url(q: kase.case_name)
      end
    end

    assert_response :success
    assert_select 'tbody tr', count: 1 do
      assert_select 'td', text: '98.765'
      assert_select 'td', text: user.fullname
    end
    assert_equal 1, loaded_scores
    assert_equal 1, score_queries.size
    assert_no_match(/case_scores[`"]?\.\*/, score_queries.first)
    assert_no_match(/[`"]queries[`"]/, score_queries.first)
  ensure
    Bullet.enable = bullet_enabled
  end

  test 'index counts associated judgements for all displayed cases in one query' do
    rated = Case.create!(case_name: 'Ratings badge rated', owner: user)
    2.times do |index|
      rated.queries.create!(query_text: "rated #{index}").ratings.create!(doc_id: 'doc', rating: 1)
    end
    Case.create!(case_name: 'Ratings badge unrated', owner: user)
    ratings_queries = []
    subscriber = lambda do |_name, _start, _finish, _id, payload|
      ratings_queries << payload[:sql] if payload[:sql].match?(/FROM [`"]?ratings/i)
    end

    ActiveSupport::Notifications.subscribed(subscriber, 'sql.active_record') do
      get cases_url(q: 'Ratings badge')
    end

    assert_response :success
    assert_equal 1, ratings_queries.size, ratings_queries.join("\n")
    assert_select 'tr', text: /Ratings badge rated/ do
      assert_select 'span.badge', text: '2'
    end
    assert_select 'tr', text: /Ratings badge unrated/ do
      assert_select 'span.badge', count: 0
    end
  end

  test 'index displays Never Run and System for missing scores and score users' do
    kase = cases(:queries_case)
    kase.scores.delete_all
    bullet_enabled = Bullet.enable?
    Bullet.enable = false

    get cases_url(q: kase.case_name)
    assert_response :success
    assert_select 'tbody tr td', text: 'Never Run'

    kase.scores.create!(try: kase.tries.first, score: 1, user: nil)
    get cases_url(q: kase.case_name)
    assert_response :success
    assert_select 'tbody tr td', text: 'System'
  ensure
    Bullet.enable = bullet_enabled
  end

  test 'expired core JSON actions return sign-in without mutating cases' do
    kase = cases(:queries_case)
    query_count = kase.queries.count
    delete logout_path

    post archive_case_url(kase), as: :json
    assert_response :unauthorized
    assert_equal new_session_path, response.parsed_body['redirect_url']
    assert_not kase.reload.archived

    delete case_queries_url(kase), as: :json
    assert_response :unauthorized
    assert_equal new_session_path, response.parsed_body['redirect_url']
    assert_equal query_count, kase.queries.count

    delete case_url(kase), as: :json
    assert_response :unauthorized
    assert_equal new_session_path, response.parsed_body['redirect_url']
    assert Case.exists?(kase.id)

    post archive_case_url(kase)
    assert_redirected_to new_session_path
  end

  test 'core JSON actions return their existing success destinations' do
    kase = cases(:queries_case)
    Bullet.enable = false

    delete case_queries_url(kase), as: :json
    assert_response :success
    assert_equal case_core_path(id: kase.id, try_number: kase.last_try_number), response.parsed_body['redirect_url']
    assert_empty kase.queries.reload

    post archive_case_url(kase), as: :json
    assert_response :success
    assert_equal cases_path, response.parsed_body['redirect_url']
    assert kase.reload.archived

    delete case_url(kase), as: :json
    assert_response :success
    assert_equal cases_path, response.parsed_body['redirect_url']
    assert_nil Case.find_by(id: kase.id)
  ensure
    Bullet.enable = true
  end

  test 'core JSON actions reject inaccessible cases without mutations or redirects' do
    kase = cases(:owned_case)
    original_queries = kase.queries.count
    [ :destroy_queries, :archive, :destroy ].each do |action|
      if :archive == action
        post archive_case_url(kase), as: :json
      else
        delete(:destroy_queries == action ? case_queries_url(kase) : case_url(kase), as: :json)
      end
      assert_response :not_found
      assert_equal 'Case not found.', response.parsed_body['error']
      assert_equal original_queries, kase.queries.count
      assert_not kase.reload.archived
    end
  end

  test 'destroy permanently deletes a case the user owns and redirects to the cases listing' do
    kase = cases(:queries_case)

    Bullet.enable = false
    assert_difference('Case.count', -1) do
      delete case_url(kase)
    end
    Bullet.enable = true

    assert_response :see_other
    assert_redirected_to cases_path
    assert_nil Case.find_by(id: kase.id)
  end

  test 'destroy does not delete a case the user is not involved with' do
    kase = cases(:owned_case)

    assert_no_difference('Case.count') do
      delete case_url(kase)
    end

    assert_response :see_other
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

    assert_response :see_other
    assert_redirected_to case_core_path(id: kase.id, try_number: kase.last_try_number)
    assert_not_nil Case.find_by(id: kase.id)
  end

  test 'destroy_queries does not delete queries for a case the user is not involved with' do
    kase = cases(:owned_case)

    delete case_queries_url(kase)

    assert_response :see_other
    assert_redirected_to cases_path
  end

  test 'archive marks a case the user owns as archived and redirects to the cases listing' do
    kase = cases(:queries_case)

    post archive_case_url(kase)

    assert_response :see_other
    assert_redirected_to cases_path
    assert kase.reload.archived
    assert_equal user, kase.owner
  end

  test 'archive does not archive a case the user is not involved with' do
    kase = cases(:owned_case)

    post archive_case_url(kase)

    assert_response :see_other
    assert_redirected_to cases_path
    assert_not kase.reload.archived
  end

  test 'unarchive restores a case the user owns and redirects to the cases listing' do
    kase = cases(:queries_case)
    kase.mark_archived!

    post unarchive_case_url(kase)

    assert_response :see_other
    assert_redirected_to cases_path
    assert_not kase.reload.archived
  end

  test 'unarchive does not touch a case the user is not involved with' do
    kase = cases(:owned_case)
    kase.mark_archived!

    post unarchive_case_url(kase)

    assert_response :see_other
    assert_redirected_to cases_path
    assert kase.reload.archived
  end
end
