# frozen_string_literal: true

class ProfilesController < ApplicationController
  def show; end

  def update
    # Update a separate copy so a failed save doesn't leave unsaved values on current_user,
    # which the layout's navbar renders.
    @profile_user = User.find(current_user.id)

    respond_to do |format|
      if @profile_user.update user_params
        Analytics::Tracker.track_user_updated_profile_event @profile_user
        format.html { redirect_to profile_path, notice: 'Profile updated successfully.', status: :see_other }
        format.json { render :show, status: :ok, location: @profile_user }
      else
        format.html { render :show, status: :unprocessable_content, locals: { active_error_section: :profile } }
        format.json { render json: @profile_user.errors, status: :unprocessable_content }
      end
    end
  end

  private

  def user_params
    params.expect(user: [ :name, :email, :company, :email_marketing ])
  end
end
