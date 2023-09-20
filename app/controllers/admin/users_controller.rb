# frozen_string_literal: true

require 'csv'

module Admin
  class UsersController < Admin::AdminController
    before_action :set_user, only: [ :show, :edit, :update, :destroy ]

    # GET /admin/users
    # GET /admin/users.json
    # GET /admin/users.csv
    def index
      @shallow = 'true' == params[:shallow]

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
    def show
      # Figure out which date to use in the pulse charts to mark the beginning of the users account with Quepid
      @pulse_chart_start_date = if @user.terms_and_conditions? && @user.agreed_time.present?
                                  @user.agreed_time
                                else
                                  @user.created_at
                                end
      @pulse_chart_start_date = @pulse_chart_start_date.strftime('%Y-%m-%d')
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
          # rubocop:disable Rails/SkipsModelValidations
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
          format.json { render json: @user.errors, status: :unprocessable_entity }
        end
      end
    end
    # rubocop:enable Metrics/MethodLength

    # DELETE /admin/users/1
    # DELETE /admin/users/1.json
    def destroy
      @user.destroy
      respond_to do |format|
        format.html { redirect_to admin_users_url, notice: 'User account was successfully deleted.' }
        format.json { head :no_content }
      end
    end

    private

    # Use callbacks to share common setup or constraints between actions.
    def set_user
      @user = User.find(params[:id])
    end

    # Never trust parameters from the scary internet, only allow the permitted list through.
    def user_params
      params.require(:user).permit(
        :administrator,
        :email,
        :name,
        :company,
        :password,
        :password_confirmation
      )
    end
  end
end
