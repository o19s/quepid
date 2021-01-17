# frozen_string_literal: true

require 'csv'

module Admin
  class UsersController < Admin::AdminController
    before_action :set_user, only: [ :show, :edit, :update ]

    # GET /admin/users
    # GET /admin/users.json
    # GET /admin/users.csv
    def index
      @users = User.all

      respond_to do |format|
        format.json
        format.html
        format.csv do
          headers['Content-Disposition'] = 'attachment; filename=\"quepid_users.csv\"'
          headers['Content-Type'] ||= 'text/csv'
        end
      end
    end

    # GET /admin/users/1
    # GET /admin/users/1.json
    def show; end

    # GET /admin/users/1/edit
    def edit; end

    # PATCH/PUT /admin/users/1
    # PATCH/PUT /admin/users/1.json
    def update
      respond_to do |format|
        if @user.update(user_params)
          Analytics::Tracker.track_user_updated_by_admin_event @user

          format.html { redirect_to admin_user_path @user }
          format.json { render :show, status: :ok, location: edit_admin_user_path(@user) }
        else
          format.html { render :edit }
          format.json { render json: @user.errors, status: :unprocessable_entity }
        end
      end
    end

    private

    # Use callbacks to share common setup or constraints between actions.
    def set_user
      @user = User.find(params[:id])
    end

    # Never trust parameters from the scary internet, only allow the white list through.
    def user_params
      params.require(:user).permit(
        :administrator,
        :email
      )
    end
  end
end
