UPGRADE_RAILS_SIX

Todo:
* Test out the SSL.   We can remove the force_ssl methods.  https://api.rubyonrails.org/classes/ActionDispatch/SSL.html
and https://github.com/rails/rails/pull/32277 and force_ssl if: :ssl_enabled?

* Check if the home_controller.rb needs a redirect to before_action :redirect_to_non_ssl ?
