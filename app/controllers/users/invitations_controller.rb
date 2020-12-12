class Users::InvitationsController < Devise::InvitationsController
  force_ssl if: :ssl_enabled?
  skip_before_action :require_login,              only: [ :edit, :update ]

  #layout 'admin'

  def update
    super

    session[:current_user_id] = @user.id
  end

  private
  def update_resource_params
    params.require(:user).permit(:name, :email,:invitation_token, :password, :password_confirmation)
  end
end
