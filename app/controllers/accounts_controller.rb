# frozen_string_literal: true

class AccountsController < ApplicationController
  force_ssl if: :ssl_enabled?

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/PerceivedComplexity
  # rubocop:disable Metrics/MethodLength
  def update
    @user = current_user
    error = false

    if params[:new_password].blank? || params[:current_password].blank?
      flash.now[:error] = 'Please fill all required fields.'
      error = true
    elsif params[:new_password] != params[:confirm_password]
      flash.now[:error] = 'The new passwords do not match!'
      error = true
    elsif !verify_password(@user, params[:current_password])
      flash.now[:error] = 'The original password is incorrect.'
      error = true
    elsif @user.update password: params[:new_password]
      Analytics::Tracker.track_user_updated_password_event @user
      flash.now[:success] = 'Account updated successfully.'
    else
      flash.now[:error] = 'Oooops! Something happened, please double check your values and try again.'
      error = true
    end

    respond_to do |format|
      format.html do
        if error
          render 'profiles/show'
        else
          redirect_to profile_path
        end
      end
      format.js
    end
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/PerceivedComplexity
  # rubocop:enable Metrics/AbcSize

  private

  def verify_password user, password
    # NOTE: this might not be obvious at first but what's going on here is
    # that BCrypt::Password.new creates an object can be compared to a clear
    # text string, but when you inspect it the output, it will actually print
    # out the encrypted string, so you'll get something like this:
    # "$2a$12$mkv3x4WGIo4PfWlnKoIxFerH8E9fK..." == "password"
    # which is confusing, but it works.
    BCrypt::Password.new(user.password) == password
  end
end
