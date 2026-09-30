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
