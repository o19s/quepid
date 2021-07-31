UPGRADE_RAILS_SIX

Todo:
* DONE - Test out the SSL.   We can remove the force_ssl methods.  https://api.rubyonrails.org/classes/ActionDispatch/SSL.html
and https://github.com/rails/rails/pull/32277 and force_ssl if: :ssl_enabled?
* DONE - Check if the home_controller.rb needs a redirect to before_action :redirect_to_non_ssl ?  -
  Turns Out it does!   

* DONE - Confirm webpack actually being used.  - IT'S NOT BEING USED, LETS WORRY ABOUT IT IN SEPERATE PR!
* DONE - The "loose" option must be the same for @babel/plugin-proposal-class-properties, @babel/plugin-proposal-private-methods and @babel/plugin-proposal-private-property-in-object (when they are enabled): you can silence this warning by explicitly adding

 ["@babel/plugin-proposal-private-methods", { "loose": true }]

to the "plugins" section of your Babel config.

* Get `webpack-dev-server` to run in dev mode to enable the autoreload.  https://dev.to/vvo/a-rails-6-setup-guide-for-2019-and-2020-hf5

* DONE - check out running `docker r rails app:update`  https://selleo.com/blog/how-to-upgrade-to-rails-6

* DONE - check https://railsdiff.org/5.2.3/6.1.4

* check<meta name="viewport" content="width=device-width,initial-scale=1"> on application.html.erb
* DONE - bin/spring?
* DONE - bin/rails?

* Check on node versions for prod and dev
* DONE - test:frontend doesn't run in Docker.
* DONE - Bump to Ruby 2.7.4 right before the merge ;-)
* check on bootstrap 3 to bootstrap 4  http://upgrade-bootstrap.bootply.com/
* Check on bootstrap 4 versus 5 https://designmodo.com/migrate-bootstrap-5/
