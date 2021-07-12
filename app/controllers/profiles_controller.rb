# frozen_string_literal: true

class ProfilesController < ApplicationController
  # TODO: don't know what to do with it yet
  # force_ssl if: :ssl_enabled?
  layout 'account'

  def show; end

  def update
    respond_to do |format|
      if current_user.update user_params
        Analytics::Tracker.track_user_updated_profile_event current_user
        format.html { redirect_to profile_path, notice: 'Profile updated successfully.' }
        format.json { render :show, status: :ok, location: current_user }
      else
        format.html { redirect_to profile_path }
        format.json { render json: current_user.errors, status: :unprocessable_entity }
      end
    end
  end

  private

  def user_params
    params.require(:user).permit(:name, :email, :company, :email_marketing)
  end
end
