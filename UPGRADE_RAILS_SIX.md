UPGRADE_RAILS_SIX

Todo:
* Test out the SSL.   We can remove the force_ssl methods.  https://api.rubyonrails.org/classes/ActionDispatch/SSL.html
and https://github.com/rails/rails/pull/32277 and force_ssl if: :ssl_enabled?
* Check if the home_controller.rb needs a redirect to before_action :redirect_to_non_ssl ?  -
  Turns Out it does!   

* Confirm webpack actually being used.
* look at all the build output that looks like:
* The "loose" option must be the same for @babel/plugin-proposal-class-properties, @babel/plugin-proposal-private-methods and @babel/plugin-proposal-private-property-in-object (when they are enabled): you can silence this warning by explicitly adding

 ["@babel/plugin-proposal-private-methods", { "loose": true }]

to the "plugins" section of your Babel config.

* Bump to Ruby 2.7.3 right before the merge ;-)
