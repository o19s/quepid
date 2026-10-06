# frozen_string_literal: true

require 'test_helper'

class GetMutationsTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:random)
    @book = books(:james_bond_movies)
    @pair = query_doc_pairs(:jbm_qdp4)
    login_user_for_integration_test @user
  end

  test 'GET and HEAD cannot mark a pair for later or log out' do
    [ :get, :head ].each do |verb|
      [ logout_path, book_query_doc_pair_judge_later_path(@book, @pair) ].each do |path|
        assert_no_difference 'Judgement.count' do
          public_send(verb, path)
          assert_response :not_found
        end
        assert_equal @user.id, session[:current_user_id]
      end
    end
  end

  test 'judge later uses a separate POST form and repeated submissions keep one judgement' do
    get book_judge_path(@book)
    assert_select 'form#judge-later-form[method="post"]'
    assert_select 'button[form="judge-later-form"][type="submit"]', text: 'I will Judge Later'
    assert_select 'a[href*="judge_later"]', count: 0

    assert_difference 'Judgement.count', 1 do
      post book_query_doc_pair_judge_later_path(@book, @pair)
    end
    assert_response :see_other
    assert_redirected_to book_judge_path(@book)
    assert_no_difference 'Judgement.count' do
      post book_query_doc_pair_judge_later_path(@book, @pair)
    end
    assert_response :see_other
    judgement = Judgement.find_by!(query_doc_pair: @pair, user: @user)
    assert judgement.judge_later
    assert_nil judgement.rating
  end

  test 'logout uses a DELETE form with a full page session boundary and 303' do
    get books_path
    assert_select 'form[action=?][method="post"][data-turbo="false"]', logout_path do
      assert_select 'input[name="_method"][value="delete"]'
      assert_select 'button', text: 'Log out'
    end
    assert_select 'a[href=?]', logout_path, count: 0

    delete logout_path
    assert_response :see_other
    assert_redirected_to sessions_path
    assert_nil session[:current_user_id]
  end

  test 'speculative requests cannot advance the judging counter or create judgements' do
    get book_judge_path(@book)
    counter = session[:track_judging].stringify_keys

    %w[X-Sec-Purpose Sec-Purpose Purpose].each do |header|
      assert_no_difference 'Judgement.count' do
        get book_judge_path(@book), headers: { header => 'prefetch' }
      end
      assert_response :bad_request
      assert_includes response.headers['Cache-Control'], 'no-store'
      assert_equal counter, session[:track_judging].stringify_keys
    end
    get book_skip_judging_path(@book), headers: { 'X-Sec-Purpose' => 'prefetch' }
    assert_response :bad_request
    assert_equal counter, session[:track_judging].stringify_keys

    get book_judge_path(@book)
    assert_equal counter['counter'] + 1, session[:track_judging].stringify_keys['counter']
  end

  test 'speculative entry requests stop before persisted and background side effects' do
    wizard = MapperWizardState.create!(user: @user, search_url: 'https://example.test')
    kase = cases(:one)
    original_name = kase.case_name
    [ root_path, case_new_path, case_core_path(cases(:one)), new_mapper_wizard_path,
      book_path(@book), api_book_path(@book) ].each do |path|
      assert_no_enqueued_jobs do
        assert_no_difference [ 'Case.count', 'SearchEndpoint.count', 'AnnouncementViewed.count', 'MapperWizardState.count' ] do
          get path, params:  { caseName: 'Speculative rename', searchEngine: 'solr', searchUrl: 'https://example.test' },
                    headers: { 'X-Sec-Purpose' => 'prefetch' }
        end
      end
      assert_response :bad_request
      assert_equal @user.id, session[:current_user_id]
      assert_equal original_name, kase.reload.case_name
      assert_equal 'https://example.test', wizard.reload.search_url
    end
  end
end
