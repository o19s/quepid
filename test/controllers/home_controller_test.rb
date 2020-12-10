# frozen_string_literal: true

require 'test_helper'

class HomeControllerTest < ActionController::TestCase
  TRY_INFO        = /bootstrapTryNo.*?(\d*);/.freeze
  CASE_INFO       = /bootstrapCaseNo.*?(\d*);/.freeze
  TRIGGER_WIZARD  = /triggerWizard\ =\s*(\w*);/.freeze

  before do
    @controller = HomeController.new
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
    let(:the_try)   { the_case.tries.best }

    before do
      login_user user
    end

    test 'bootstraps latest case' do
      get :index

      case_info = CASE_INFO.match(response.body)
      assert_equal the_case.id.to_s, case_info[1]
    end

    test 'bootstraps latest try' do
      get :index

      try_info = TRY_INFO.match(response.body)
      assert_equal the_try.try_number.to_s, try_info[1]
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

  describe 'trigger wizard when user has no cases but has logged in before' do
    let(:user) do
      User.create(
        email:       'foo@example.com',
        password:    'password',
        first_login: false
      )
    end

    before do
      user.cases = []
      user.save
      login_user user
    end

    test 'bootstraps latest case' do
      get :index

      trigger = TRIGGER_WIZARD.match(response.body)
      assert_equal 'true', trigger[1]
    end
  end
end
