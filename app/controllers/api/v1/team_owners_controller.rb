# # frozen_string_literal: true

# module Api
#   module V1
#     class TeamOwnersController < Api::ApiController
#       before_action :set_team, only: [ :update ]
#       before_action :check_team_owner, only: [ :update ]

#       def update
#         previous_owner = @team.owner
#         @team.members << previous_owner unless @team.members.exists?(previous_owner.id)

#         if @team.update(owner_id: params[:id])
#           respond_with @team
#         else
#           render json: @team.errors, status: :bad_request
#         end
#       end
#     end
#   end
# end
