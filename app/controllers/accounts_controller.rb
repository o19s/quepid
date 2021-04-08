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
      flash[:error] = 'Please fill all required fields.'
      error = true
    elsif params[:new_password] != params[:confirm_password]
      flash[:error] = 'The new passwords do not match!'
      error = true
    elsif !verify_password(@user, params[:current_password])
      flash[:error] = 'The original password is incorrect.'
      error = true
    elsif @user.update password: params[:new_password]
      Analytics::Tracker.track_user_updated_password_event @user
      flash[:success] = 'Account updated successfully.'
    else
      flash[:error] = 'Oooops! Something happened, please double check your values and try again.'
      error = true
    end

    respond_to do |format|
      format.html do
        if error
          render 'profiles/show'
        else
          redirect_to profile_path
          #render 'profiles/show'
        end
      end
      format.js
    end
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/PerceivedComplexity
  # rubocop:enable Metrics/AbcSize


  def destroy
    @user = current_user
    able_to_destroy = true    # This should probably be at the Model level.
    @user.owned_teams.each do |team|
      @user.errors.add(:base, "Please reassign ownership of the team #{team.name}." ) if team.members.count > 1
    end

    unless @user.errors.empty?
      able_to_destroy = false
    end

    if able_to_destroy then
      @user.cases.each do |c|
        if c.teams.empty?
          c.really_destroy
        else
          c.user = nil
          c.save
        end
      end

      @user.destroy
      able_to_destroy = @user.destroyed?
    end


    respond_to do |format|
      if able_to_destroy
        format.html { redirect_to secure_url, notice: 'Account was deleted' }
        format.json { head :no_content }
      else
        format.html { render 'profiles/show' }
        format.json { render json: @user.errors, status: :unprocessable_entity }
      end
    end

  end

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
