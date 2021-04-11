# frozen_string_literal: true

class ProfilesController < ApplicationController
  force_ssl if: :ssl_enabled?
  layout 'account'

  def show; end

  def update
    #if current_user.update user_params
    #  Analytics::Tracker.track_user_updated_profile_event current_user
    #  flash[:success] = 'Profile updated successfully.'
    #else
    #  flash[:error] = if current_user.errors.empty?
    #                        'Oooops! Something happened, please double check your values and try again.'
  #                        else
  #                          current_user.errors.full_messages.join(' <br />')
  #                        end
  #  end

    #respond_to do |format|
    #  format.html { redirect_to profile_path }
    #  format.js
    #end
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
