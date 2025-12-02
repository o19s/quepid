# frozen_string_literal: true

require 'csv'

module Admin
  class UsersController < Admin::AdminController
    include Pagy::Backend

    before_action :set_user, only: [ :show, :edit, :update, :destroy, :assign_judgements_to_anonymous_user ]

    # GET /admin/users
    # GET /admin/users.json
    # GET /admin/users.csv
    def index
      @shallow = 'true' == params[:shallow]

      query = User.order(created_at: :desc)

      if params[:q].present?
        query = query.where('users.name LIKE ? OR users.email LIKE ?',
                            "%#{params[:q]}%", "%#{params[:q]}%")
      end

      respond_to do |format|
        format.html { @pagy, @users = pagy(query) }
        format.json { @users = query.all }
        format.csv do
          @users = query.all
          headers['Content-Disposition'] = 'attachment; filename=\"quepid_users.csv\"'
          headers['Content-Type'] ||= 'text/csv'
        end
      end
    end

    # GET /admin/users/1
    # GET /admin/users/1.json
    def show
    end

    def new
      @user = User.new
    end

    # GET /admin/users/1/edit
    def edit; end

    def create
      params_to_use = user_params
      if params[:password_encrypted].present?
        params_to_use[:password] = 'blah'
        params_to_use[:password_confirmation] = 'blah'
      end

      @user = User.new params_to_use

      if @user.save
        if params[:password_encrypted].present?
          # avoid the encrypt call back
          @user.update_column(:password, params[:password_encrypted])
          # rubocop:enable Rails/SkipsModelValidations
        end

        redirect_to admin_user_path(@user)
      else
        render action: :new
      end
    end

    # PATCH/PUT /admin/users/1
    # PATCH/PUT /admin/users/1.json
    # rubocop:disable Metrics/MethodLength
    def update
      respond_to do |format|
        params_to_use = user_params

        if params[:password_encrypted].present?
          # avoid the encrypt call back
          params_to_use[:password] = 'blah'
          params_to_use[:password_confirmation] = 'blah'
        end

        if @user.update(params_to_use)
          if params[:password_encrypted].present?
            # avoid the encrypt call back
            # rubocop:disable Rails/SkipsModelValidations
            @user.update_column(:password, params[:password_encrypted])
            # rubocop:enable Rails/SkipsModelValidations
          end
          Analytics::Tracker.track_user_updated_by_admin_event @user

          format.html { redirect_to admin_user_path @user }
          format.json { render :show, status: :ok, location: edit_admin_user_path(@user) }
        else
          format.html { render :edit }
          format.json { render json: @user.errors, status: :unprocessable_content }
        end
      end
    end
    # rubocop:enable Metrics/MethodLength

    # DELETE /admin/users/1
    # DELETE /admin/users/1.json
    def destroy
      if @user.destroy
        respond_to do |format|
          format.html { redirect_to admin_users_url, notice: 'User account was successfully deleted.' }
          format.json { head :no_content }
        end
      else
        respond_to do |format|
          format.html { render :edit }
          format.json { render json: @user.errors, status: :unprocessable_content }
        end
      end
    end

    def assign_judgements_to_anonymous_user
      @user.judgements.each do |j|
        j.user = nil
        j.save!
      end

      redirect_to admin_user_path @user, notice: 'All judgements assigned to anonymous user.'
    end

    private

    # Use callbacks to share common setup or constraints between actions.
    def set_user
      @user = User.find(params[:id])
    end

    # Never trust parameters from the scary internet, only allow the permitted list through.
    def user_params
      params.expect(
        user: [ :administrator,
                :email,
                :name,
                :company,
                :password,
                :password_confirmation ]
      )
    end
  end
end
