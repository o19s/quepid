# frozen_string_literal: true

class ApiKeysController < ApplicationController
  # include ApiKeyAuthenticatable

  # skip_before_action :require_login

  # Require token authentication for index
  # prepend_before_action :authenticate_with_api_key!, only: [ :index ]

  # Optional token authentication for logout
  # prepend_before_action :authenticate_with_api_key, only: [ :destroy ]

  # curl -v -X GET http://localhost:3000/api-keys -H 'Authorization: Bearer 2d499887717072dd1a31f3d9be4e295e'
  # def index
  # render json: current_user.api_keys
  # end

  # curl -v -X POST http://localhost:3000/api-keys -u quepid+admin@o19s.com:password
  def create
    @api_key = current_user.api_keys.create! token: SecureRandom.hex

    redirect_to profile_path

    # authenticate_with_http_basic do |email, password|
    #  user = User.find_by email: email
    #
    #      if user&.authenticate(password)
    #        api_key = user.api_keys.create! token: SecureRandom.hex
    #
    #        render json: api_key, status: :created and return
    ##      end
    #    end
  end

  # curl -v -X DELETE http://localhost:3000/api-keys -H 'Authorization: Bearer 2d499887717072dd1a31f3d9be4e295e'
  def destroy
    @api_key = current_user.api_keys.find(params[:id])
    @api_key.destroy
    redirect_to profile_path
  end
end
