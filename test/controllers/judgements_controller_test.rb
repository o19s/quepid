# frozen_string_literal: true

require 'test_helper'

class JudgementsControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  let(:book) { books(:book_of_comedy_films) }

  setup do
    @judgement = judgements(:one)
    get '/books'
    assert_equal 302, status
    follow_redirect!

    login_user
  end

  test 'should get index' do
    get book_judgements_url book
    assert_response :success
  end

  #   test 'should get new' do
  #     get new_judgement_url
  #     assert_response :success
  #   end

  #   test 'should create judgement' do
  #     assert_difference('Judgement.count') do
  #       post judgements_url,
  #            params: { judgement: { query_doc_pair_id: @judgement.query_doc_pair_id, rating: @judgement.rating,
  # user_id: @judgement.user_id } }
  #     end

  #     assert_redirected_to judgement_url(Judgement.last)
  #   end

  #   test 'should show judgement' do
  #     get judgement_url(@judgement)
  #     assert_response :success
  #   end

  #   test 'should get edit' do
  #     get edit_judgement_url(@judgement)
  #     assert_response :success
  #   end

  #   test 'should update judgement' do
  #     patch judgement_url(@judgement),
  #           params: { judgement: { query_doc_pair_id: @judgement.query_doc_pair_id, rating: @judgement.rating,
  # user_id: @judgement.user_id } }
  #     assert_redirected_to judgement_url(@judgement)
  #   end

  #   test 'should destroy judgement' do
  #     assert_difference('Judgement.count', -1) do
  #       delete judgement_url(@judgement)
  #     end

  #     assert_redirected_to judgements_url
  #   end

  def login_user
    # We don't actually want to load up scores...
    Bullet.enable = false
    # post the login and follow through to the home page
    post '/users/login', params: { user: { email: user.email, password: 'password' } }
    follow_redirect!
    assert_equal 200, status
    assert_equal '/', path

    Bullet.enable = true
  end
end
