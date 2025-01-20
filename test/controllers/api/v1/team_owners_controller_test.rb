# # frozen_string_literal: true

# require 'test_helper'

# module Api
#   module V1
#     class TeamOwnersControllerTest < ActionController::TestCase
#       let(:owner) { users(:team_owner) }
#       let(:member1) { users(:team_member_1) }
#       let(:owned_team) { teams(:team_owner_team) }

#       before do
#         @controller = Api::V1::TeamOwnersController.new
#       end

#       describe 'Updating a teams owner' do
#         test 'user successfully updates an owned teams owner' do
#           login_user owner

#           put :update, params: { team_id: owned_team.id, id: member1.id }
#           assert_response :ok

#           assert_equal owner.owned_teams.count, 0
#           assert_equal member1.owned_teams.count, 1
#         end

#         test 'user cannot update a non-owned teams owner' do
#           login_user member1

#           put :update, params: { team_id: owned_team.id, id: member1.id }
#           assert_response :forbidden
#         end
#       end
#     end
#   end
# end
