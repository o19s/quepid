class Users::InvitationsController < Devise::InvitationsController
  force_ssl if: :ssl_enabled?
  skip_before_action :require_login,              only: [ :edit, :update ]

  layout 'admin'

  #def update
  #  if some_condition
  #    redirect_to root_path
  #  else
  #    super
  #  end
  #end

  #def edit
    #super
    #@user = User.accept_invitation!(invitation_token: params[:invitation_token], password: 'ad97nwj3o2', name: 'John Doe')
    #@team = @user.teams.first

    #redirect_to secure_complete_path
  #end

  #def after_accept_path_for resource
  #  puts "I am in in the after accept path"
  #  secure_complete_path
  #end

  def update
    super

    session[:current_user_id] = @user.id
  end
end
