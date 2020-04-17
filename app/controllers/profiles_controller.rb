# frozen_string_literal: true

class ProfilesController < ApplicationController
  force_ssl if: :ssl_enabled?

  def show; end

  def update
    if current_user.update user_params
      Analytics::Tracker.track_user_updated_profile_event current_user
      flash.now[:success] = 'Profile updated successfully.'
    else
      flash.now[:error] = if current_user.errors.empty?
                            'Oooops! Something happened, please double check your values and try again.'
                          else
                            current_user.errors.full_messages.join(' <br />')
                          end
    end

    respond_to do |format|
      format.html { redirect_to profile_path }
      format.js
    end
  end

  private

  def user_params
    params.require(:user).permit(:name, :email, :company, :email_marketing)
  end
end
