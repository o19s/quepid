# frozen_string_literal: true

require 'test_helper'

class CoreControllerTest < ActionController::TestCase
  TRY_INFO        = /bootstrapTryNo.*?(\d*);/
  CASE_INFO       = /bootstrapCaseNo.*?(\d*);/

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
  end

  describe 'Bootstrap case and try' do
    let(:user)      { users(:bootstrap_user) }
    let(:the_case)  { user.cases.where.not(archived: true).last }
    let(:the_try)   { the_case.tries.latest }

    before do
      login_user user
    end

    test 'bootstraps latest case ' do
      get :index

      case_info = CASE_INFO.match(response.body)
      assert_equal the_case.id.to_s, case_info[1]

      try_info = TRY_INFO.match(response.body)
      assert_equal the_try.try_number.to_s, try_info[1]
    end

    # We used to redirect the browser to match the
    # search engine URL, but don't do that anymore.'
    test 'bootstraps case with HTTPS search_engine ' do
      the_try.search_url = 'https://somesearch.com'
      the_try.save!

      get :index

      assert_response :ok
      # assert response.body.include?('<a href="https://test.host/">redirected</a>')
    end

    test 'bootstraps non deleted/archived case' do
      deleted_case = user.cases.create case_name: 'archived case'
      deleted_case.update archived: true

      get :index

      case_info = CASE_INFO.match(response.body)
      assert_not_equal deleted_case.id.to_s, case_info[1]
    end

    test 'bootstraps not deleted try' do
      deleted_try = the_case.tries.create try_number: 100

      get :index

      try_info = TRY_INFO.match(response.body)
      assert_equal deleted_try.try_number.to_s, try_info[1]

      deleted_try.delete

      get :index

      try_info = TRY_INFO.match(response.body)
      assert_not_equal deleted_try.try_number.to_s, try_info[1]
    end
  end

  describe 'bootstraps when user has no cases, not in team, but has logged in before' do
    let(:user) do
      User.create(
        email:    'foo@example.com',
        password: 'password'
      )
    end

    before do
      user.cases = []
      user.save
      login_user user
    end

    test 'bootstraps without creating a case or a try' do
      get :index

      assert_response :ok

      user.reload

      assert_empty user.cases

      case_info = CASE_INFO.match(response.body)
      try_info = TRY_INFO.match(response.body)
      assert_equal '0', case_info[1]
      assert_equal '0', try_info[1]
    end
  end
end
