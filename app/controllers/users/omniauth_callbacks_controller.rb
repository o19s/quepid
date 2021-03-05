class Users::OmniauthCallbacksController < Devise::OmniauthCallbacksController
  force_ssl if: :ssl_enabled?
  skip_before_action :require_login, only: [ :keycloakopenid, :failure ]
  def keycloakopenid
    Rails.logger.debug(request.env["omniauth.auth"])
    # Examples online suggest that I should have a from_omniauth or find_or_create_from_auth_hash
    # methods injected into my User class by a gem, however I had to manually add mine.
    #@user = User.from_omniauth(request.env["omniauth.auth"])
    #@user = User.find_or_create_from_auth_hash(request.env["omniauth.auth"])
    @user = User.from_omniauth_custom(request.env["omniauth.auth"])
    if @user.persisted?
      Rails.logger.warn("user did persisted")
      session[:current_user_id] = @user.id  # this populates our session variable.
      #sign_in_and_redirect @user, event: :authentication
      redirect_to secure_path
    else
      Rails.logger.warn("user not persisted, what do we need to do?")
      session["devise.keycloakopenid_data"] = request.env["omniauth.auth"]
      redirect_to new_user_registration_url
    end
  end

  def failure
    redirect_to root_path
  end
end
