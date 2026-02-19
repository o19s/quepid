# frozen_string_literal: true

require 'test_helper'

class CasesControllerTest < ActionDispatch::IntegrationTest
  before do
    @user = users(:random)
    login_user_for_integration_test @user
  end

  describe 'authorization' do
    it 'prevents archiving a case the user does not have access to' do
      inaccessible_case = cases(:not_shared)

      post archive_case_path(inaccessible_case)

      assert_redirected_to cases_path
      assert_equal 'Case not found.', flash[:alert]
      assert_not inaccessible_case.reload.archived
    end

    it 'prevents unarchiving a case the user does not have access to' do
      inaccessible_case = cases(:not_shared)
      inaccessible_case.update!(archived: true)

      post unarchive_case_path(inaccessible_case)

      assert_redirected_to cases_path
      assert_equal 'Case not found.', flash[:alert]
      assert inaccessible_case.reload.archived
    end

    it 'allows archiving a case the user owns' do
      owned_case = cases(:import_ratings_case)

      post archive_case_path(owned_case)

      assert_redirected_to cases_path
      assert owned_case.reload.archived
    end
  end
end
