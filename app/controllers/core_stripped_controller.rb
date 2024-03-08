# frozen_string_literal: true

# This hosts the stripped down version Angular 1 application that runs in the client.
# It is meant to wrap up the business logic used in interacting with a search endpoint
# and abstract that all away from the caller.  We create a HTML page that is populated
# with the resulting query/docs.  Currently using the "snapshot" JSON format.
# It is meant to be called by agent_q_controller.rb.
# 
class CoreStrippedController < ApplicationController
  include ApiKeyAuthenticatable
  skip_before_action :check_for_announcement
  before_action :authenticate_with_api_key! # , only: [:index]

  def require_login
    if request.headers['Authorization']
      token = request.headers['Authorization']
      token = token[7..] # chop off 'Bearer ' portion of the header
      current_api_key = ApiKey.find_by token_digest: token

      @current_user = current_api_key.user
    end
  end

  # Spiking out can we make an API public?
  def authenticate_api!
    set_case
    return true if @case&.public? || current_user

    render json:   { reason: 'Unauthorized!' },
           status: :unauthorized
  end

  def index
  end

end
