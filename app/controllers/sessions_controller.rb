# frozen_string_literal: true

class SessionsController < ApplicationController
  skip_before_action :require_login,              only: [ :create, :new ]
  skip_before_action :check_current_user_locked!, only: :create
  skip_before_action :verify_authenticity_token,  only: :create

  def index
  end

  def new
    @user = User.new

    if Rails.env.production? && Rails.application.config.devise.omniauth_providers.include?(:google_oauth2)
      # Google only lets us oAuth from https sites in production.
      @flag_not_on_https = false
      @flag_not_on_https = true unless request.ssl? || 'https' == request.headers['X-Forwarded-Proto']
    end
  end

  def create
    login_params = user_params

    @user = login(login_params[:email], login_params[:password])
    respond_to do |format|
      if @user
        format.html { redirect_to root_path }
        format.json { render json: { message: 'connected' }, status: :ok }
      else
        @user = User.new(email: login_params[:email])

        # rubocop:disable Layout/LineLength
        @user.errors.add(:base,
                         'Unknown email/password combo. Double check you have the correct email address and password, or sign up for a new account.' )
        # rubocop:enable Layout/LineLength
        format.html { render :new }
        format.json { render json: { reason: @error }, status: :unprocessable_entity }
      end
    end
  end

  def destroy
    clear_user_session

    redirect_to sessions_path
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

    ahoy.authenticate(user)
    user
  end

  def user_params
    params.expect(user: [ :email, :password ])
  end
end
