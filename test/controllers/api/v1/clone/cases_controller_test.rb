# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Clone
      class CasesControllerTest < ActionController::TestCase
        let(:user)      { users(:random_1) }
        let(:the_case)  { cases(:random_case) }
        let(:the_try)   { tries(:try_with_curator_vars) }

        before do
          @controller = Api::V1::Clone::CasesController.new

          login_user user
        end

        describe 'clone' do
          it 'creates a new case with all of the tries from the original case' do
            assert_difference 'Case.count' do
              assert_difference 'Try.count', the_case.tries.count do
                data = {
                  case_id:          the_case.id,
                  preserve_history: true,
                }

                post :create, params: data

                assert_response :ok

                cloned_case = assigns(:new_case)

                assert_equal the_case.tries.count, cloned_case.tries.count
                assert_equal 0, cloned_case.queries.count
                assert_equal user.id, cloned_case.owner_id
                assert_equal "Cloned: #{the_case.case_name}", cloned_case.case_name
              end
            end
          end

          it 'creates a new case with the try specified' do
            assert_difference 'Case.count' do
              assert_difference 'Try.count' do
                data = {
                  case_id:    the_case.id,
                  try_number: the_try.try_number,
                }

                post :create, params: data

                assert_response :ok

                cloned_case = assigns(:new_case)

                assert_equal 1, cloned_case.tries.count
                assert_equal 0, cloned_case.queries.count
                assert_equal user.id, cloned_case.owner_id
                assert_equal "Cloned: #{the_case.case_name}", cloned_case.case_name

                cloned_try = cloned_case.tries.latest

                assert_equal the_try.query_params,  cloned_try.query_params
                assert_equal 'id:id title:title',   cloned_try.field_spec
                assert_equal the_try.search_endpoint, cloned_try.search_endpoint
                assert_equal 'Try 1',               cloned_try.name
                # assert_equal the_try.search_engine, cloned_try.search_engine
                assert_equal the_try.escape_query,  cloned_try.escape_query
                # assert_equal the_try.api_method,    cloned_try.api_method
                assert_equal the_try.curator_variables.size, cloned_try.curator_variables.size
              end
            end
          end
        end
      end
    end
  end
end
