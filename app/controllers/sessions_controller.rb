# frozen_string_literal: true

class SessionsController < ApplicationController
  force_ssl if: :ssl_enabled?
  skip_before_action :require_login,              only: :create
  skip_before_action :check_current_user_locked!, only: :create
  skip_before_action :verify_authenticity_token,  only: :create

  def create
    user = login(params[:email], params[:password])
    respond_to do |format|
      if user
        format.json { render json: { message: 'connected' }, status: :ok }
      else
        format.json { render json: { reason: @error }, status: :unprocessable_entity }
      end
    end
  end

  def destroy
    clear_user_session

    redirect_to secure_path
  end

  private

  def login email, password
    user = User.where(email: email.downcase).first

    return nil unless user

    if user.locked?
      @error = 'LOCKED'
      return nil
    end

    # NOTE: this might not be obvious at first but what's going on here is
    # that BCrypt::Password.new creates an object can be compared to a clear
    # text string, but when you inspect it the output, it will actually print
    # out the encrypted string, so you'll get something like this:
    # "$2a$12$mkv3x4WGIo4PfWlnKoIxFerH8E9fKdw..." == "password"
    # which is confusing, but it works.
    return unless user && (BCrypt::Password.new(user.password) == password)

    session[:current_user_id] = user.id

    user.num_logins ||= 0
    user.num_logins  += 1
    user.save

    user
  end
end
