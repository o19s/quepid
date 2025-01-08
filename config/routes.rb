# frozen_string_literal: true

# rubocop:disable Layout/LineLength

# == Route Map
#
#                                           Prefix Verb     URI Pattern                                                                                       Controller#Action
#                                                           /cable                                                                                            #<ActionCable::Server::Base:0x00007fbdccaa2530 @config=#<ActionCable::Server::Configuration:0x00007fbdccaaf0f0 @log_tags=[:channel, :connection, :transmissions, :state_updates], @connection_class=#<Proc:0x00007fbdccab3768 /usr/local/bundle/gems/actioncable-8.0.0/lib/action_cable/engine.rb:55 (lambda)>, @worker_pool_size=4, @disable_request_forgery_protection=true, @allow_same_origin_as_host=true, @filter_parameters=[:passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn, :cvv, :cvc, :document_fields, "query_doc_pair.document_fields", "snapshot.docs", "snapshot_doc.explain", "snapshot_doc.fields"], @health_check_application=#<Proc:0x00007fbdccab63a0 /usr/local/bundle/gems/actioncable-8.0.0/lib/action_cable/engine.rb:31 (lambda)>, @logger=#<ActiveSupport::BroadcastLogger:0x00007fbdcdc142c8 @broadcasts=[#<ActiveSupport::Logger:0x00007fbdce79fb10 @level=0, @progname=nil, @default_formatter=#<Logger::Formatter:0x00007fbdcdc16af0 @datetime_format=nil>, @formatter=#<TruncatingFormatter:0x00007fbdcdc14750 @datetime_format=nil, @limit=5000>, @logdev=#<Logger::LogDevice:0x00007fbdcda94380 @shift_period_suffix="%Y%m%d", @shift_size=104857600, @shift_age=1, @filename="/srv/app/log/development.log", @dev=#<File:/srv/app/log/development.log>, @binmode=false, @reraise_write_errors=[], @mon_data=#<Monitor:0x00007fbdcdc16a78>, @mon_data_owner_object_id=7340>, @level_override={}>], @progname="Broadcast", @formatter=#<TruncatingFormatter:0x00007fbdcdc14750 @datetime_format=nil, @limit=5000>>, @cable={"adapter"=>"solid_cable", "polling_interval"=>"0.1.seconds", "message_retention"=>"1.day", "silence_polling"=>true}, @mount_path="/cable", @precompile_assets=true, @allowed_request_origins="*", @url="/cable">, @mutex=#<Monitor:0x00007fbdcca92720>, @pubsub=nil, @worker_pool=nil, @event_loop=nil, @remote_connections=nil>
#                           apipie_apipie_checksum GET      /apipie/apipie_checksum(.:format)                                                                 apipie/apipies#apipie_checksum {:format=>/json/}
#                                    apipie_apipie GET      /apipie(/:version)(/:resource)(/:method)(.:format)                                                apipie/apipies#index {:version=>/[^\/]+/, :resource=>/[^\/]+/, :method=>/[^\/]+/}
#                                active_storage_db          /active_storage_db                                                                                ActiveStorageDB::Engine
#                               rails_health_check GET      /healthcheck(.:format)                                                                            rails/health#show
#                             mission_control_jobs          /admin/jobs                                                                                       MissionControl::Jobs::Engine
#                                           blazer          /admin/blazer                                                                                     Blazer::Engine
#                                             root GET      /                                                                                                 home#show
#                                  home_sparklines GET      /home/sparklines(.:format)                                                                        home#sparklines
#                                home_case_prophet GET      /home/case_prophet/:case_id(.:format)                                                             home#case_prophet
#                                      proxy_fetch GET      /proxy/fetch(.:format)                                                                            proxy#fetch
#                                                  POST     /proxy/fetch(.:format)                                                                            proxy#fetch
#                                         api_keys POST     /api-keys(.:format)                                                                               api_keys#create
#                                          api_key DELETE   /api-keys/:id(.:format)                                                                           api_keys#destroy
#                            clone_search_endpoint GET      /search_endpoints/:id/clone(.:format)                                                             search_endpoints#clone
#                                 search_endpoints GET      /search_endpoints(.:format)                                                                       search_endpoints#index
#                                                  POST     /search_endpoints(.:format)                                                                       search_endpoints#create
#                              new_search_endpoint GET      /search_endpoints/new(.:format)                                                                   search_endpoints#new
#                             edit_search_endpoint GET      /search_endpoints/:id/edit(.:format)                                                              search_endpoints#edit
#                                  search_endpoint GET      /search_endpoints/:id(.:format)                                                                   search_endpoints#show
#                                                  PATCH    /search_endpoints/:id(.:format)                                                                   search_endpoints#update
#                                                  PUT      /search_endpoints/:id(.:format)                                                                   search_endpoints#update
#                                                  DELETE   /search_endpoints/:id(.:format)                                                                   search_endpoints#destroy
#                                                  GET      /.well-known/acme-challenge/9IWOgATbRmEtWKsOOJQ-E4-lrIT9tHsHv_9bl5Zt6fI(.:format)                 Inline handler (Proc/Lambda)
#                                      users_login POST     /users/login(.:format)                                                                            sessions#create
#                                     users_signup POST     /users/signup(.:format)                                                                           users/signups#create
#                                           logout GET      /logout(.:format)                                                                                 sessions#destroy
#                                         sessions GET      /sessions(.:format)                                                                               sessions#index
#                                                  POST     /sessions(.:format)                                                                               sessions#create
#                                      new_session GET      /sessions/new(.:format)                                                                           sessions#new
#                                     edit_session GET      /sessions/:id/edit(.:format)                                                                      sessions#edit
#                                          session GET      /sessions/:id(.:format)                                                                           sessions#show
#                                                  PATCH    /sessions/:id(.:format)                                                                           sessions#update
#                                                  PUT      /sessions/:id(.:format)                                                                           sessions#update
#                                                  DELETE   /sessions/:id(.:format)                                                                           sessions#destroy
#                                          account PATCH    /account(.:format)                                                                                accounts#update
#                                                  PUT      /account(.:format)                                                                                accounts#update
#                                                  DELETE   /account(.:format)                                                                                accounts#destroy
#                                          profile GET      /profile(.:format)                                                                                profiles#show
#                                                  PATCH    /profile(.:format)                                                                                profiles#update
#                                                  PUT      /profile(.:format)                                                                                profiles#update
#                                    new_case_book GET      /cases/:case_id/book/new(.:format)                                                                books#new
#                                   edit_case_book GET      /cases/:case_id/book/edit(.:format)                                                               books#edit
#                                        case_book GET      /cases/:case_id/book(.:format)                                                                    books#show
#                                                  PATCH    /cases/:case_id/book(.:format)                                                                    books#update
#                                                  PUT      /cases/:case_id/book(.:format)                                                                    books#update
#                                                  DELETE   /cases/:case_id/book(.:format)                                                                    books#destroy
#                                                  POST     /cases/:case_id/book(.:format)                                                                    books#create
#                                     case_ratings GET      /cases/:case_id/ratings(.:format)                                                                 ratings#index
#                                  book_judgements GET      /books/:book_id/judgements(.:format)                                                              judgements#index
#                                                  POST     /books/:book_id/judgements(.:format)                                                              judgements#create
#                               new_book_judgement GET      /books/:book_id/judgements/new(.:format)                                                          judgements#new
#                              edit_book_judgement GET      /books/:book_id/judgements/:id/edit(.:format)                                                     judgements#edit
#                                   book_judgement GET      /books/:book_id/judgements/:id(.:format)                                                          judgements#show
#                                                  PATCH    /books/:book_id/judgements/:id(.:format)                                                          judgements#update
#                                                  PUT      /books/:book_id/judgements/:id(.:format)                                                          judgements#update
#                                                  DELETE   /books/:book_id/judgements/:id(.:format)                                                          judgements#destroy
#                   book_query_doc_pair_judgements GET      /books/:book_id/query_doc_pairs/:query_doc_pair_id/judgements(.:format)                           judgements#index
#                                                  POST     /books/:book_id/query_doc_pairs/:query_doc_pair_id/judgements(.:format)                           judgements#create
#                new_book_query_doc_pair_judgement GET      /books/:book_id/query_doc_pairs/:query_doc_pair_id/judgements/new(.:format)                       judgements#new
#               edit_book_query_doc_pair_judgement GET      /books/:book_id/query_doc_pairs/:query_doc_pair_id/judgements/:id/edit(.:format)                  judgements#edit
#                    book_query_doc_pair_judgement GET      /books/:book_id/query_doc_pairs/:query_doc_pair_id/judgements/:id(.:format)                       judgements#show
#                                                  PATCH    /books/:book_id/query_doc_pairs/:query_doc_pair_id/judgements/:id(.:format)                       judgements#update
#                                                  PUT      /books/:book_id/query_doc_pairs/:query_doc_pair_id/judgements/:id(.:format)                       judgements#update
#                                                  DELETE   /books/:book_id/query_doc_pairs/:query_doc_pair_id/judgements/:id(.:format)                       judgements#destroy
#                   book_query_doc_pair_unrateable POST     /books/:book_id/query_doc_pairs/:query_doc_pair_id/unrateable(.:format)                           judgements#unrateable
#                                                  PATCH    /books/:book_id/query_doc_pairs/:query_doc_pair_id/unrateable(.:format)                           judgements#unrateable
#                  book_query_doc_pair_judge_later GET      /books/:book_id/query_doc_pairs/:query_doc_pair_id/judge_later(.:format)                          judgements#judge_later
#                             book_query_doc_pairs GET      /books/:book_id/query_doc_pairs(.:format)                                                         query_doc_pairs#index
#                                                  POST     /books/:book_id/query_doc_pairs(.:format)                                                         query_doc_pairs#create
#                          new_book_query_doc_pair GET      /books/:book_id/query_doc_pairs/new(.:format)                                                     query_doc_pairs#new
#                         edit_book_query_doc_pair GET      /books/:book_id/query_doc_pairs/:id/edit(.:format)                                                query_doc_pairs#edit
#                              book_query_doc_pair GET      /books/:book_id/query_doc_pairs/:id(.:format)                                                     query_doc_pairs#show
#                                                  PATCH    /books/:book_id/query_doc_pairs/:id(.:format)                                                     query_doc_pairs#update
#                                                  PUT      /books/:book_id/query_doc_pairs/:id(.:format)                                                     query_doc_pairs#update
#                                                  DELETE   /books/:book_id/query_doc_pairs/:id(.:format)                                                     query_doc_pairs#destroy
#                                       book_judge GET      /books/:book_id/judge(.:format)                                                                   judgements#new
#                                book_skip_judging GET      /books/:book_id/skip_judging(.:format)                                                            judgements#skip_judging
#                                     combine_book PATCH    /books/:id/combine(.:format)                                                                      books#combine
#                            assign_anonymous_book PATCH    /books/:id/assign_anonymous(.:format)                                                             books#assign_anonymous
#                  delete_ratings_by_assignee_book DELETE   /books/:id/delete_ratings_by_assignee(.:format)                                                   books#delete_ratings_by_assignee
#                            reset_unrateable_book DELETE   /books/:id/reset_unrateable/:user_id(.:format)                                                    books#reset_unrateable
#                           reset_judge_later_book DELETE   /books/:id/reset_judge_later/:user_id(.:format)                                                   books#reset_judge_later
#       delete_query_doc_pairs_below_position_book DELETE   /books/:id/delete_query_doc_pairs_below_position(.:format)                                        books#delete_query_doc_pairs_below_position
#                       eric_steered_us_wrong_book PATCH    /books/:id/eric_steered_us_wrong(.:format)                                                        books#eric_steered_us_wrong
#                                            books GET      /books(.:format)                                                                                  books#index
#                                                  POST     /books(.:format)                                                                                  books#create
#                                         new_book GET      /books/new(.:format)                                                                              books#new
#                                        edit_book GET      /books/:id/edit(.:format)                                                                         books#edit
#                                             book GET      /books/:id(.:format)                                                                              books#show
#                                                  PATCH    /books/:id(.:format)                                                                              books#update
#                                                  PUT      /books/:id(.:format)                                                                              books#update
#                                                  DELETE   /books/:id(.:format)                                                                              books#destroy
#                               books_import_index POST     /books/import(.:format)                                                                           books/import#create
#                                 new_books_import GET      /books/import/new(.:format)                                                                       books/import#new
#                                     books_export PATCH    /books/export/:book_id(.:format)                                                                  books/export#update
#                                                  PUT      /books/export/:book_id(.:format)                                                                  books/export#update
#           user_keycloakopenid_omniauth_authorize GET|POST /users/auth/keycloakopenid(.:format)                                                              users/omniauth_callbacks#passthru
#            user_keycloakopenid_omniauth_callback GET|POST /users/auth/keycloakopenid/callback(.:format)                                                     users/omniauth_callbacks#keycloakopenid
#            user_google_oauth2_omniauth_authorize GET|POST /users/auth/google_oauth2(.:format)                                                               users/omniauth_callbacks#passthru
#             user_google_oauth2_omniauth_callback GET|POST /users/auth/google_oauth2/callback(.:format)                                                      users/omniauth_callbacks#google_oauth2
#                                new_user_password GET      /users/password/new(.:format)                                                                     users/passwords#new
#                               edit_user_password GET      /users/password/edit(.:format)                                                                    users/passwords#edit
#                                    user_password PATCH    /users/password(.:format)                                                                         users/passwords#update
#                                                  PUT      /users/password(.:format)                                                                         users/passwords#update
#                                                  POST     /users/password(.:format)                                                                         users/passwords#create
#                           accept_user_invitation GET      /users/invitation/accept(.:format)                                                                users/invitations#edit
#                           remove_user_invitation GET      /users/invitation/remove(.:format)                                                                users/invitations#destroy
#                              new_user_invitation GET      /users/invitation/new(.:format)                                                                   users/invitations#new
#                                  user_invitation PATCH    /users/invitation(.:format)                                                                       users/invitations#update
#                                                  PUT      /users/invitation(.:format)                                                                       users/invitations#update
#                                                  POST     /users/invitation(.:format)                                                                       users/invitations#create
#                    analytics_tries_visualization GET      /analytics/tries_visualization/:case_id(.:format)                                                 analytics/tries_visualization#show
# analytics_tries_visualization_vega_specification GET      /analytics/tries_visualization/:case_id/vega_specification(.:format)                              analytics/tries_visualization#vega_specification
#          analytics_tries_visualization_vega_data GET      /analytics/tries_visualization/:case_id/vega_data(.:format)                                       analytics/tries_visualization#vega_data
#                        analytics_case_visibility PATCH    /analytics/cases/:case_id/visibility(.:format)                                                    analytics/cases/visibilities#update
#                                                  PUT      /analytics/cases/:case_id/visibility(.:format)                                                    analytics/cases/visibilities#update
#                  analytics_case_duplicate_scores GET      /analytics/cases/:case_id/duplicate_scores(.:format)                                              analytics/cases/duplicate_scores#show
#                                  analytics_cases GET      /analytics/cases(.:format)                                                                        analytics/cases#index
#                                                  POST     /analytics/cases(.:format)                                                                        analytics/cases#create
#                               new_analytics_case GET      /analytics/cases/new(.:format)                                                                    analytics/cases#new
#                              edit_analytics_case GET      /analytics/cases/:id/edit(.:format)                                                               analytics/cases#edit
#                                   analytics_case GET      /analytics/cases/:id(.:format)                                                                    analytics/cases#show
#                                                  PATCH    /analytics/cases/:id(.:format)                                                                    analytics/cases#update
#                                                  PUT      /analytics/cases/:id(.:format)                                                                    analytics/cases#update
#                                                  DELETE   /analytics/cases/:id(.:format)                                                                    analytics/cases#destroy
#           analytics_sparkline_vega_specification GET      /analytics/sparkline/vega_specification(.:format)                                                 analytics/sparkline#vega_specification
#                    analytics_sparkline_vega_data GET      /analytics/sparkline/vega_data(.:format)                                                          analytics/sparkline#vega_data
#                                            admin GET      /admin(.:format)                                                                                  admin/home#index
#                                  admin_user_lock PATCH    /admin/users/:user_id/lock(.:format)                                                              admin/users/locks#update
#                                                  PUT      /admin/users/:user_id/lock(.:format)                                                              admin/users/locks#update
#                                 admin_user_pulse GET      /admin/users/:user_id/pulse(.:format)                                                             admin/users/pulses#show
#   assign_judgements_to_anonymous_user_admin_user POST     /admin/users/:id/assign_judgements_to_anonymous_user(.:format)                                    admin/users#assign_judgements_to_anonymous_user
#                                      admin_users GET      /admin/users(.:format)                                                                            admin/users#index
#                                                  POST     /admin/users(.:format)                                                                            admin/users#create
#                                   new_admin_user GET      /admin/users/new(.:format)                                                                        admin/users#new
#                                  edit_admin_user GET      /admin/users/:id/edit(.:format)                                                                   admin/users#edit
#                                       admin_user GET      /admin/users/:id(.:format)                                                                        admin/users#show
#                                                  PATCH    /admin/users/:id(.:format)                                                                        admin/users#update
#                                                  PUT      /admin/users/:id(.:format)                                                                        admin/users#update
#                                                  DELETE   /admin/users/:id(.:format)                                                                        admin/users#destroy
#                           admin_communal_scorers GET      /admin/communal_scorers(.:format)                                                                 admin/communal_scorers#index
#                                                  POST     /admin/communal_scorers(.:format)                                                                 admin/communal_scorers#create
#                        new_admin_communal_scorer GET      /admin/communal_scorers/new(.:format)                                                             admin/communal_scorers#new
#                       edit_admin_communal_scorer GET      /admin/communal_scorers/:id/edit(.:format)                                                        admin/communal_scorers#edit
#                            admin_communal_scorer GET      /admin/communal_scorers/:id(.:format)                                                             admin/communal_scorers#show
#                                                  PATCH    /admin/communal_scorers/:id(.:format)                                                             admin/communal_scorers#update
#                                                  PUT      /admin/communal_scorers/:id(.:format)                                                             admin/communal_scorers#update
#                                                  DELETE   /admin/communal_scorers/:id(.:format)                                                             admin/communal_scorers#destroy
#                       publish_admin_announcement POST     /admin/announcements/:id/publish(.:format)                                                        admin/announcements#publish
#                              admin_announcements GET      /admin/announcements(.:format)                                                                    admin/announcements#index
#                                                  POST     /admin/announcements(.:format)                                                                    admin/announcements#create
#                           new_admin_announcement GET      /admin/announcements/new(.:format)                                                                admin/announcements#new
#                          edit_admin_announcement GET      /admin/announcements/:id/edit(.:format)                                                           admin/announcements#edit
#                               admin_announcement GET      /admin/announcements/:id(.:format)                                                                admin/announcements#show
#                                                  PATCH    /admin/announcements/:id(.:format)                                                                admin/announcements#update
#                                                  PUT      /admin/announcements/:id(.:format)                                                                admin/announcements#update
#                                                  DELETE   /admin/announcements/:id(.:format)                                                                admin/announcements#destroy
# test_background_job_admin_websocket_tester_index POST     /admin/websocket_tester/test_background_job(.:format)                                             admin/websocket_tester#test_background_job
#                     admin_websocket_tester_index GET      /admin/websocket_tester(.:format)                                                                 admin/websocket_tester#index
#                                                  GET      /rails/mailers(.:format)                                                                          rails/mailers#index
#                                                  GET      /rails/mailers/*path(.:format)                                                                    rails/mailers#preview
#                                         api_test GET      /api/test(.:format)                                                                               api/api#test {:format=>:json}
#                               api_test_exception GET      /api/test_exception(.:format)                                                                     api/api#test_exception {:format=>:json}
#                                current_api_users GET      /api/users/current(.:format)                                                                      api/v1/current_user#show {:format=>:json}
#                                        api_users GET      /api/users(.:format)                                                                              api/v1/users#index {:format=>:json}
#                                         api_user GET      /api/users/:id(.:format)                                                                          api/v1/users#show {:format=>:json}
#                                                  PATCH    /api/users/:id(.:format)                                                                          api/v1/users#update {:format=>:json}
#                                                  PUT      /api/users/:id(.:format)                                                                          api/v1/users#update {:format=>:json}
#                                      api_signups POST     /api/signups(.:format)                                                                            api/v1/signups#create {:format=>:json}
#                               api_dropdown_cases GET      /api/dropdown/cases(.:format)                                                                     api/v1/cases/dropdown#index {:format=>:json}
#                               api_dropdown_books GET      /api/dropdown/books(.:format)                                                                     api/v1/books/dropdown#index {:format=>:json}
#                                        api_cases GET      /api/cases(.:format)                                                                              api/v1/cases#index {:format=>:json}
#                                                  POST     /api/cases(.:format)                                                                              api/v1/cases#create {:format=>:json}
#                                         api_case GET      /api/cases/:case_id(.:format)                                                                     api/v1/cases#show {:format=>:json}
#                                                  PATCH    /api/cases/:case_id(.:format)                                                                     api/v1/cases#update {:format=>:json}
#                                                  PUT      /api/cases/:case_id(.:format)                                                                     api/v1/cases#update {:format=>:json}
#                                                  DELETE   /api/cases/:case_id(.:format)                                                                     api/v1/cases#destroy {:format=>:json}
#                       api_case_try_duplicate_try POST     /api/cases/:case_id/tries/:try_try_number/duplicate(.:format)                                     api/v1/duplicate_tries#create {:format=>:json}
#                                   api_case_tries GET      /api/cases/:case_id/tries(.:format)                                                               api/v1/tries#index {:format=>:json}
#                                                  POST     /api/cases/:case_id/tries(.:format)                                                               api/v1/tries#create {:format=>:json}
#                                edit_api_case_try GET      /api/cases/:case_id/tries/:try_number/edit(.:format)                                              api/v1/tries#edit {:format=>:json}
#                                     api_case_try GET      /api/cases/:case_id/tries/:try_number(.:format)                                                   api/v1/tries#show {:format=>:json}
#                                                  PATCH    /api/cases/:case_id/tries/:try_number(.:format)                                                   api/v1/tries#update {:format=>:json}
#                                                  PUT      /api/cases/:case_id/tries/:try_number(.:format)                                                   api/v1/tries#update {:format=>:json}
#                                                  DELETE   /api/cases/:case_id/tries/:try_number(.:format)                                                   api/v1/tries#destroy {:format=>:json}
#                                 api_case_scorers GET      /api/cases/:case_id/scorers(.:format)                                                             api/v1/case_scorers#index {:format=>:json}
#                                  api_case_scorer PATCH    /api/cases/:case_id/scorers/:id(.:format)                                                         api/v1/case_scorers#update {:format=>:json}
#                                                  PUT      /api/cases/:case_id/scorers/:id(.:format)                                                         api/v1/case_scorers#update {:format=>:json}
#                             api_case_query_notes GET      /api/cases/:case_id/queries/:query_id/notes(.:format)                                             api/v1/queries/notes#show {:format=>:json}
#                                                  PATCH    /api/cases/:case_id/queries/:query_id/notes(.:format)                                             api/v1/queries/notes#update {:format=>:json}
#                                                  PUT      /api/cases/:case_id/queries/:query_id/notes(.:format)                                             api/v1/queries/notes#update {:format=>:json}
#                           api_case_query_options GET      /api/cases/:case_id/queries/:query_id/options(.:format)                                           api/v1/queries/options#show {:format=>:json}
#                                                  PATCH    /api/cases/:case_id/queries/:query_id/options(.:format)                                           api/v1/queries/options#update {:format=>:json}
#                                                  PUT      /api/cases/:case_id/queries/:query_id/options(.:format)                                           api/v1/queries/options#update {:format=>:json}
#                          api_case_query_position PATCH    /api/cases/:case_id/queries/:query_id/position(.:format)                                          api/v1/queries/positions#update {:format=>:json}
#                                                  PUT      /api/cases/:case_id/queries/:query_id/position(.:format)                                          api/v1/queries/positions#update {:format=>:json}
#                           api_case_query_ratings PATCH    /api/cases/:case_id/queries/:query_id/ratings(.:format)                                           api/v1/queries/ratings#update {:format=>:json}
#                                                  PUT      /api/cases/:case_id/queries/:query_id/ratings(.:format)                                           api/v1/queries/ratings#update {:format=>:json}
#                                                  DELETE   /api/cases/:case_id/queries/:query_id/ratings(.:format)                                           api/v1/queries/ratings#destroy {:format=>:json}
#                      api_case_query_bulk_ratings PATCH    /api/cases/:case_id/queries/:query_id/bulk/ratings(.:format)                                      api/v1/bulk_ratings#update {:format=>:json}
#                                                  PUT      /api/cases/:case_id/queries/:query_id/bulk/ratings(.:format)                                      api/v1/bulk_ratings#update {:format=>:json}
#                                                  DELETE   /api/cases/:case_id/queries/:query_id/bulk/ratings(.:format)                                      api/v1/bulk_ratings#destroy {:format=>:json}
#               ratings_delete_api_case_query_bulk POST     /api/cases/:case_id/queries/:query_id/bulk/ratings/delete(.:format)                               api/v1/bulk_ratings#destroy {:format=>:json}
#                                 api_case_queries GET      /api/cases/:case_id/queries(.:format)                                                             api/v1/queries#index {:format=>:json}
#                                                  POST     /api/cases/:case_id/queries(.:format)                                                             api/v1/queries#create {:format=>:json}
#                                   api_case_query PATCH    /api/cases/:case_id/queries/:id(.:format)                                                         api/v1/queries#update {:format=>:json}
#                                                  PUT      /api/cases/:case_id/queries/:id(.:format)                                                         api/v1/queries#update {:format=>:json}
#                                                  DELETE   /api/cases/:case_id/queries/:id(.:format)                                                         api/v1/queries#destroy {:format=>:json}
#                   api_case_snapshot_search_index GET      /api/cases/:case_id/snapshots/:snapshot_id/search(.:format)                                       api/v1/snapshots/search#index {:format=>:json}
#                               api_case_snapshots GET      /api/cases/:case_id/snapshots(.:format)                                                           api/v1/snapshots#index {:format=>:json}
#                                                  POST     /api/cases/:case_id/snapshots(.:format)                                                           api/v1/snapshots#create {:format=>:json}
#                                api_case_snapshot GET      /api/cases/:case_id/snapshots/:id(.:format)                                                       api/v1/snapshots#show {:format=>:json}
#                                                  DELETE   /api/cases/:case_id/snapshots/:id(.:format)                                                       api/v1/snapshots#destroy {:format=>:json}
#                       api_case_snapshots_imports POST     /api/cases/:case_id/snapshots/imports(.:format)                                                   api/v1/snapshots/imports#create {:format=>:json}
#                                api_case_metadata PATCH    /api/cases/:case_id/metadata(.:format)                                                            api/v1/case_metadata#update {:format=>:json}
#                                                  PUT      /api/cases/:case_id/metadata(.:format)                                                            api/v1/case_metadata#update {:format=>:json}
#                                  api_case_scores GET      /api/cases/:case_id/scores(.:format)                                                              api/v1/case_scores#show {:format=>:json}
#                                                  PATCH    /api/cases/:case_id/scores(.:format)                                                              api/v1/case_scores#update {:format=>:json}
#                                                  PUT      /api/cases/:case_id/scores(.:format)                                                              api/v1/case_scores#update {:format=>:json}
#                              api_case_scores_all GET      /api/cases/:case_id/scores/all(.:format)                                                          api/v1/case_scores#index {:format=>:json}
#                             api_case_annotations GET      /api/cases/:case_id/annotations(.:format)                                                         api/v1/annotations#index {:format=>:json}
#                                                  POST     /api/cases/:case_id/annotations(.:format)                                                         api/v1/annotations#create {:format=>:json}
#                          new_api_case_annotation GET      /api/cases/:case_id/annotations/new(.:format)                                                     api/v1/annotations#new {:format=>:json}
#                         edit_api_case_annotation GET      /api/cases/:case_id/annotations/:id/edit(.:format)                                                api/v1/annotations#edit {:format=>:json}
#                              api_case_annotation PATCH    /api/cases/:case_id/annotations/:id(.:format)                                                     api/v1/annotations#update {:format=>:json}
#                                                  PUT      /api/cases/:case_id/annotations/:id(.:format)                                                     api/v1/annotations#update {:format=>:json}
#                                                  DELETE   /api/cases/:case_id/annotations/:id(.:format)                                                     api/v1/annotations#destroy {:format=>:json}
#                        api_case_search_endpoints GET      /api/cases/:case_id/search_endpoints(.:format)                                                    api/v1/search_endpoints#index {:format=>:json}
#                                api_book_populate PUT      /api/books/:book_id/populate(.:format)                                                            api/v1/books/populate#update {:format=>:json}
#                            api_book_case_refresh PUT      /api/books/:book_id/cases/:case_id/refresh(.:format)                                              api/v1/books/refresh#update {:format=>:json}
#                                   api_book_cases GET      /api/books/:book_id/cases(.:format)                                                               api/v1/cases#index {:format=>:json}
#                                                  POST     /api/books/:book_id/cases(.:format)                                                               api/v1/cases#create {:format=>:json}
#                                new_api_book_case GET      /api/books/:book_id/cases/new(.:format)                                                           api/v1/cases#new {:format=>:json}
#                               edit_api_book_case GET      /api/books/:book_id/cases/:id/edit(.:format)                                                      api/v1/cases#edit {:format=>:json}
#                                    api_book_case GET      /api/books/:book_id/cases/:id(.:format)                                                           api/v1/cases#show {:format=>:json}
#                                                  PATCH    /api/books/:book_id/cases/:id(.:format)                                                           api/v1/cases#update {:format=>:json}
#                                                  PUT      /api/books/:book_id/cases/:id(.:format)                                                           api/v1/cases#update {:format=>:json}
#                                                  DELETE   /api/books/:book_id/cases/:id(.:format)                                                           api/v1/cases#destroy {:format=>:json}
#                                                  GET      /api/books/:book_id/query_doc_pairs/to_be_judged/:judge_id(.:format)                              api/v1/query_doc_pairs#to_be_judged {:format=>:json}
#                         api_book_query_doc_pairs GET      /api/books/:book_id/query_doc_pairs(.:format)                                                     api/v1/query_doc_pairs#index {:format=>:json}
#                                                  POST     /api/books/:book_id/query_doc_pairs(.:format)                                                     api/v1/query_doc_pairs#create {:format=>:json}
#                      new_api_book_query_doc_pair GET      /api/books/:book_id/query_doc_pairs/new(.:format)                                                 api/v1/query_doc_pairs#new {:format=>:json}
#                     edit_api_book_query_doc_pair GET      /api/books/:book_id/query_doc_pairs/:id/edit(.:format)                                            api/v1/query_doc_pairs#edit {:format=>:json}
#                          api_book_query_doc_pair GET      /api/books/:book_id/query_doc_pairs/:id(.:format)                                                 api/v1/query_doc_pairs#show {:format=>:json}
#                                                  PATCH    /api/books/:book_id/query_doc_pairs/:id(.:format)                                                 api/v1/query_doc_pairs#update {:format=>:json}
#                                                  PUT      /api/books/:book_id/query_doc_pairs/:id(.:format)                                                 api/v1/query_doc_pairs#update {:format=>:json}
#                                                  DELETE   /api/books/:book_id/query_doc_pairs/:id(.:format)                                                 api/v1/query_doc_pairs#destroy {:format=>:json}
#                              api_book_judgements GET      /api/books/:book_id/judgements(.:format)                                                          api/v1/judgements#index {:format=>:json}
#                                                  POST     /api/books/:book_id/judgements(.:format)                                                          api/v1/judgements#create {:format=>:json}
#                           new_api_book_judgement GET      /api/books/:book_id/judgements/new(.:format)                                                      api/v1/judgements#new {:format=>:json}
#                          edit_api_book_judgement GET      /api/books/:book_id/judgements/:id/edit(.:format)                                                 api/v1/judgements#edit {:format=>:json}
#                               api_book_judgement GET      /api/books/:book_id/judgements/:id(.:format)                                                      api/v1/judgements#show {:format=>:json}
#                                                  PATCH    /api/books/:book_id/judgements/:id(.:format)                                                      api/v1/judgements#update {:format=>:json}
#                                                  PUT      /api/books/:book_id/judgements/:id(.:format)                                                      api/v1/judgements#update {:format=>:json}
#                                                  DELETE   /api/books/:book_id/judgements/:id(.:format)                                                      api/v1/judgements#destroy {:format=>:json}
#                                        api_books GET      /api/books(.:format)                                                                              api/v1/books#index {:format=>:json}
#                                                  POST     /api/books(.:format)                                                                              api/v1/books#create {:format=>:json}
#                                     new_api_book GET      /api/books/new(.:format)                                                                          api/v1/books#new {:format=>:json}
#                                    edit_api_book GET      /api/books/:id/edit(.:format)                                                                     api/v1/books#edit {:format=>:json}
#                                         api_book GET      /api/books/:id(.:format)                                                                          api/v1/books#show {:format=>:json}
#                                                  PATCH    /api/books/:id(.:format)                                                                          api/v1/books#update {:format=>:json}
#                                                  PUT      /api/books/:id(.:format)                                                                          api/v1/books#update {:format=>:json}
#                                                  DELETE   /api/books/:id(.:format)                                                                          api/v1/books#destroy {:format=>:json}
#                               api_clone_case_try POST     /api/clone/cases/:case_id/tries/:try_number(.:format)                                             api/v1/clone/tries#create {:format=>:json}
#                                  api_clone_cases POST     /api/clone/cases(.:format)                                                                        api/v1/clone/cases#create {:format=>:json}
#                             api_search_endpoints GET      /api/search_endpoints(.:format)                                                                   api/v1/search_endpoints#index {:format=>:json}
#                                                  POST     /api/search_endpoints(.:format)                                                                   api/v1/search_endpoints#create {:format=>:json}
#                          new_api_search_endpoint GET      /api/search_endpoints/new(.:format)                                                               api/v1/search_endpoints#new {:format=>:json}
#                         edit_api_search_endpoint GET      /api/search_endpoints/:id/edit(.:format)                                                          api/v1/search_endpoints#edit {:format=>:json}
#                              api_search_endpoint GET      /api/search_endpoints/:id(.:format)                                                               api/v1/search_endpoints#show {:format=>:json}
#                                                  PATCH    /api/search_endpoints/:id(.:format)                                                               api/v1/search_endpoints#update {:format=>:json}
#                                                  PUT      /api/search_endpoints/:id(.:format)                                                               api/v1/search_endpoints#update {:format=>:json}
#                                                  DELETE   /api/search_endpoints/:id(.:format)                                                               api/v1/search_endpoints#destroy {:format=>:json}
#                                      api_scorers GET      /api/scorers(.:format)                                                                            api/v1/scorers#index {:format=>:json}
#                                                  POST     /api/scorers(.:format)                                                                            api/v1/scorers#create {:format=>:json}
#                                       api_scorer GET      /api/scorers/:id(.:format)                                                                        api/v1/scorers#show {:format=>:json}
#                                                  PATCH    /api/scorers/:id(.:format)                                                                        api/v1/scorers#update {:format=>:json}
#                                                  PUT      /api/scorers/:id(.:format)                                                                        api/v1/scorers#update {:format=>:json}
#                                                  DELETE   /api/scorers/:id(.:format)                                                                        api/v1/scorers#destroy {:format=>:json}
#                                        api_teams GET      /api/teams(.:format)                                                                              api/v1/teams#index {:format=>:json}
#                                                  POST     /api/teams(.:format)                                                                              api/v1/teams#create {:format=>:json}
#                                         api_team GET      /api/teams/:team_id(.:format)                                                                     api/v1/teams#show {:format=>:json}
#                                                  PATCH    /api/teams/:team_id(.:format)                                                                     api/v1/teams#update {:format=>:json}
#                                                  PUT      /api/teams/:team_id(.:format)                                                                     api/v1/teams#update {:format=>:json}
#                                                  DELETE   /api/teams/:team_id(.:format)                                                                     api/v1/teams#destroy {:format=>:json}
#                                 api_team_members GET      /api/teams/:team_id/members(.:format)                                                             api/v1/team_members#index {:format=>:json}
#                                                  POST     /api/teams/:team_id/members(.:format)                                                             api/v1/team_members#create {:format=>:json}
#                                  api_team_member DELETE   /api/teams/:team_id/members/:id(.:format)                                                         api/v1/team_members#destroy {:format=>:json}
#                          api_team_members_invite POST     /api/teams/:team_id/members/invite(.:format)                                                      api/v1/team_members#invite {:format=>:json}
#                                 api_team_scorers GET      /api/teams/:team_id/scorers(.:format)                                                             api/v1/team_scorers#index {:format=>:json}
#                                                  POST     /api/teams/:team_id/scorers(.:format)                                                             api/v1/team_scorers#create {:format=>:json}
#                                  api_team_scorer DELETE   /api/teams/:team_id/scorers/:id(.:format)                                                         api/v1/team_scorers#destroy {:format=>:json}
#                                   api_team_cases GET      /api/teams/:team_id/cases(.:format)                                                               api/v1/team_cases#index {:format=>:json}
#                                                  POST     /api/teams/:team_id/cases(.:format)                                                               api/v1/team_cases#create {:format=>:json}
#                                    api_team_case DELETE   /api/teams/:team_id/cases/:id(.:format)                                                           api/v1/team_cases#destroy {:format=>:json}
#                                   api_team_owner PATCH    /api/teams/:team_id/owners/:id(.:format)                                                          api/v1/team_owners#update {:format=>:json}
#                                                  PUT      /api/teams/:team_id/owners/:id(.:format)                                                          api/v1/team_owners#update {:format=>:json}
#                                   api_team_books GET      /api/teams/:team_id/books(.:format)                                                               api/v1/team_books#index {:format=>:json}
#                        api_team_search_endpoints GET      /api/teams/:team_id/search_endpoints(.:format)                                                    api/v1/search_endpoints#index {:format=>:json}
#                                 api_import_books POST     /api/import/books(.:format)                                                                       api/v1/import/books#create {:format=>:json}
#                                 api_import_cases POST     /api/import/cases(.:format)                                                                       api/v1/import/cases#create {:format=>:json}
#                               api_import_ratings POST     /api/import/ratings(.:format)                                                                     api/v1/import/ratings#create {:format=>:json}
#             api_import_queries_information_needs POST     /api/import/queries/information_needs(.:format)                                                   api/v1/import/queries/information_needs#create {:format=>:json}
#                                  api_export_book PATCH    /api/export/books/:book_id(.:format)                                                              api/v1/export/books#update {:format=>:json}
#                                                  PUT      /api/export/books/:book_id(.:format)                                                              api/v1/export/books#update {:format=>:json}
#                                  api_export_case GET      /api/export/cases/:case_id(.:format)                                                              api/v1/export/cases#show {:format=>:json}
#                                api_export_rating GET      /api/export/ratings/:case_id(.:format)                                                            api/v1/export/ratings#show {:format=>:json}
#              api_export_queries_information_need GET      /api/export/queries/information_needs/:case_id(.:format)                                          api/v1/export/queries/information_needs#show {:format=>:json}
#                            api_bulk_case_queries POST     /api/bulk/cases/:case_id/queries(.:format)                                                        api/v1/bulk/queries#create {:format=>:json}
#                     api_bulk_case_queries_delete DELETE   /api/bulk/cases/:case_id/queries/delete(.:format)                                                 api/v1/bulk/queries#destroy {:format=>:json}
#                                        case_core GET      /case/:id(/try/:try_number)(.:format)                                                             core#index
#                                         case_new GET      /cases/new(.:format)                                                                              core#new
#                                            cases GET      /cases(.:format)                                                                                  core#index
#                                             case GET      /case(.:format)                                                                                   core#index
#                                     cases_import GET      /cases/import(.:format)                                                                           core#index
#                                       teams_core GET      /teams(/:id)(.:format)                                                                            core#teams
#                                          scorers GET      /scorers(.:format)                                                                                core#index
#                 turbo_recede_historical_location GET      /recede_historical_location(.:format)                                                             turbo/native/navigation#recede
#                 turbo_resume_historical_location GET      /resume_historical_location(.:format)                                                             turbo/native/navigation#resume
#                turbo_refresh_historical_location GET      /refresh_historical_location(.:format)                                                            turbo/native/navigation#refresh
#                                      ahoy_engine          /ahoy                                                                                             Ahoy::Engine
#                    rails_postmark_inbound_emails POST     /rails/action_mailbox/postmark/inbound_emails(.:format)                                           action_mailbox/ingresses/postmark/inbound_emails#create
#                       rails_relay_inbound_emails POST     /rails/action_mailbox/relay/inbound_emails(.:format)                                              action_mailbox/ingresses/relay/inbound_emails#create
#                    rails_sendgrid_inbound_emails POST     /rails/action_mailbox/sendgrid/inbound_emails(.:format)                                           action_mailbox/ingresses/sendgrid/inbound_emails#create
#              rails_mandrill_inbound_health_check GET      /rails/action_mailbox/mandrill/inbound_emails(.:format)                                           action_mailbox/ingresses/mandrill/inbound_emails#health_check
#                    rails_mandrill_inbound_emails POST     /rails/action_mailbox/mandrill/inbound_emails(.:format)                                           action_mailbox/ingresses/mandrill/inbound_emails#create
#                     rails_mailgun_inbound_emails POST     /rails/action_mailbox/mailgun/inbound_emails/mime(.:format)                                       action_mailbox/ingresses/mailgun/inbound_emails#create
#                   rails_conductor_inbound_emails GET      /rails/conductor/action_mailbox/inbound_emails(.:format)                                          rails/conductor/action_mailbox/inbound_emails#index
#                                                  POST     /rails/conductor/action_mailbox/inbound_emails(.:format)                                          rails/conductor/action_mailbox/inbound_emails#create
#                new_rails_conductor_inbound_email GET      /rails/conductor/action_mailbox/inbound_emails/new(.:format)                                      rails/conductor/action_mailbox/inbound_emails#new
#                    rails_conductor_inbound_email GET      /rails/conductor/action_mailbox/inbound_emails/:id(.:format)                                      rails/conductor/action_mailbox/inbound_emails#show
#         new_rails_conductor_inbound_email_source GET      /rails/conductor/action_mailbox/inbound_emails/sources/new(.:format)                              rails/conductor/action_mailbox/inbound_emails/sources#new
#            rails_conductor_inbound_email_sources POST     /rails/conductor/action_mailbox/inbound_emails/sources(.:format)                                  rails/conductor/action_mailbox/inbound_emails/sources#create
#            rails_conductor_inbound_email_reroute POST     /rails/conductor/action_mailbox/:inbound_email_id/reroute(.:format)                               rails/conductor/action_mailbox/reroutes#create
#         rails_conductor_inbound_email_incinerate POST     /rails/conductor/action_mailbox/:inbound_email_id/incinerate(.:format)                            rails/conductor/action_mailbox/incinerates#create
#                               rails_service_blob GET      /rails/active_storage/blobs/redirect/:signed_id/*filename(.:format)                               active_storage/blobs/redirect#show
#                         rails_service_blob_proxy GET      /rails/active_storage/blobs/proxy/:signed_id/*filename(.:format)                                  active_storage/blobs/proxy#show
#                                                  GET      /rails/active_storage/blobs/:signed_id/*filename(.:format)                                        active_storage/blobs/redirect#show
#                        rails_blob_representation GET      /rails/active_storage/representations/redirect/:signed_blob_id/:variation_key/*filename(.:format) active_storage/representations/redirect#show
#                  rails_blob_representation_proxy GET      /rails/active_storage/representations/proxy/:signed_blob_id/:variation_key/*filename(.:format)    active_storage/representations/proxy#show
#                                                  GET      /rails/active_storage/representations/:signed_blob_id/:variation_key/*filename(.:format)          active_storage/representations/redirect#show
#                               rails_disk_service GET      /rails/active_storage/disk/:encoded_key/*filename(.:format)                                       active_storage/disk#show
#                        update_rails_disk_service PUT      /rails/active_storage/disk/:encoded_token(.:format)                                               active_storage/disk#update
#                             rails_direct_uploads POST     /rails/active_storage/direct_uploads(.:format)                                                    active_storage/direct_uploads#create
#
# Routes for ActiveStorageDB::Engine:
#        service GET  /files/:encoded_key/*filename(.:format) active_storage_db/files#show
# update_service PUT  /files/:encoded_token(.:format)         active_storage_db/files#update
#
# Routes for MissionControl::Jobs::Engine:
#     application_queue_pause DELETE /applications/:application_id/queues/:queue_id/pause(.:format) mission_control/jobs/queues/pauses#destroy
#                             POST   /applications/:application_id/queues/:queue_id/pause(.:format) mission_control/jobs/queues/pauses#create
#          application_queues GET    /applications/:application_id/queues(.:format)                 mission_control/jobs/queues#index
#           application_queue GET    /applications/:application_id/queues/:id(.:format)             mission_control/jobs/queues#show
#       application_job_retry POST   /applications/:application_id/jobs/:job_id/retry(.:format)     mission_control/jobs/retries#create
#     application_job_discard POST   /applications/:application_id/jobs/:job_id/discard(.:format)   mission_control/jobs/discards#create
#    application_job_dispatch POST   /applications/:application_id/jobs/:job_id/dispatch(.:format)  mission_control/jobs/dispatches#create
#    application_bulk_retries POST   /applications/:application_id/jobs/bulk_retries(.:format)      mission_control/jobs/bulk_retries#create
#   application_bulk_discards POST   /applications/:application_id/jobs/bulk_discards(.:format)     mission_control/jobs/bulk_discards#create
#             application_job GET    /applications/:application_id/jobs/:id(.:format)               mission_control/jobs/jobs#show
#            application_jobs GET    /applications/:application_id/:status/jobs(.:format)           mission_control/jobs/jobs#index
#         application_workers GET    /applications/:application_id/workers(.:format)                mission_control/jobs/workers#index
#          application_worker GET    /applications/:application_id/workers/:id(.:format)            mission_control/jobs/workers#show
# application_recurring_tasks GET    /applications/:application_id/recurring_tasks(.:format)        mission_control/jobs/recurring_tasks#index
#  application_recurring_task GET    /applications/:application_id/recurring_tasks/:id(.:format)    mission_control/jobs/recurring_tasks#show
#                             PATCH  /applications/:application_id/recurring_tasks/:id(.:format)    mission_control/jobs/recurring_tasks#update
#                             PUT    /applications/:application_id/recurring_tasks/:id(.:format)    mission_control/jobs/recurring_tasks#update
#                      queues GET    /queues(.:format)                                              mission_control/jobs/queues#index
#                       queue GET    /queues/:id(.:format)                                          mission_control/jobs/queues#show
#                         job GET    /jobs/:id(.:format)                                            mission_control/jobs/jobs#show
#                        jobs GET    /:status/jobs(.:format)                                        mission_control/jobs/jobs#index
#                        root GET    /                                                              mission_control/jobs/queues#index
#
# Routes for Blazer::Engine:
#       run_queries POST   /queries/run(.:format)            blazer/queries#run
#    cancel_queries POST   /queries/cancel(.:format)         blazer/queries#cancel
#     refresh_query POST   /queries/:id/refresh(.:format)    blazer/queries#refresh
#    tables_queries GET    /queries/tables(.:format)         blazer/queries#tables
#    schema_queries GET    /queries/schema(.:format)         blazer/queries#schema
#      docs_queries GET    /queries/docs(.:format)           blazer/queries#docs
#           queries GET    /queries(.:format)                blazer/queries#index
#                   POST   /queries(.:format)                blazer/queries#create
#         new_query GET    /queries/new(.:format)            blazer/queries#new
#        edit_query GET    /queries/:id/edit(.:format)       blazer/queries#edit
#             query GET    /queries/:id(.:format)            blazer/queries#show
#                   PATCH  /queries/:id(.:format)            blazer/queries#update
#                   PUT    /queries/:id(.:format)            blazer/queries#update
#                   DELETE /queries/:id(.:format)            blazer/queries#destroy
#         run_check GET    /checks/:id/run(.:format)         blazer/checks#run
#            checks GET    /checks(.:format)                 blazer/checks#index
#                   POST   /checks(.:format)                 blazer/checks#create
#         new_check GET    /checks/new(.:format)             blazer/checks#new
#        edit_check GET    /checks/:id/edit(.:format)        blazer/checks#edit
#             check PATCH  /checks/:id(.:format)             blazer/checks#update
#                   PUT    /checks/:id(.:format)             blazer/checks#update
#                   DELETE /checks/:id(.:format)             blazer/checks#destroy
# refresh_dashboard POST   /dashboards/:id/refresh(.:format) blazer/dashboards#refresh
#        dashboards POST   /dashboards(.:format)             blazer/dashboards#create
#     new_dashboard GET    /dashboards/new(.:format)         blazer/dashboards#new
#    edit_dashboard GET    /dashboards/:id/edit(.:format)    blazer/dashboards#edit
#         dashboard GET    /dashboards/:id(.:format)         blazer/dashboards#show
#                   PATCH  /dashboards/:id(.:format)         blazer/dashboards#update
#                   PUT    /dashboards/:id(.:format)         blazer/dashboards#update
#                   DELETE /dashboards/:id(.:format)         blazer/dashboards#destroy
#              root GET    /                                 blazer/queries#home
#
# Routes for Ahoy::Engine:
# visits POST /visits(.:format) ahoy/visits#create
# events POST /events(.:format) ahoy/events#create

# rubocop:disable Metrics/BlockLength
Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  mount Debugbar::Engine => Debugbar.config.prefix if defined? Debugbar

  mount ActionCable.server => '/cable'
  apipie
  mount ActiveStorageDB::Engine => '/active_storage_db'

  # Render dynamic PWA files from app/views/pwa/*
  # get 'service-worker' => 'rails/pwa#service_worker', as: :pwa_service_worker
  # get 'manifest' => 'rails/pwa#manifest', as: :pwa_manifest

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get 'healthcheck' => 'rails/health#show', as: :rails_health_check

  constraints(AdminConstraint) do
    mount MissionControl::Jobs::Engine, at: 'admin/jobs'
    mount Blazer::Engine, at: 'admin/blazer'
  end

  root 'home#show'

  get 'home/sparklines', to: 'home#sparklines'
  get 'home/case_prophet/:case_id', to: 'home#case_prophet', as: :home_case_prophet
  # get 'tries_visualization/:case_id' => 'tries_visualization#show', as: :tries_visualization
  get 'proxy/fetch'
  post 'proxy/fetch'

  resources :api_keys, path: 'api-keys', only: [ :create, :destroy ]

  resources :search_endpoints do
    member do
      get 'clone'
    end
  end

  # let's encrypt verification (can be removed in the future)
  get '.well-known/acme-challenge/9IWOgATbRmEtWKsOOJQ-E4-lrIT9tHsHv_9bl5Zt6fI', to: proc { [ 200, {}, [ '9IWOgATbRmEtWKsOOJQ-E4-lrIT9tHsHv_9bl5Zt6fI.fDzklrX7i2PRMRsPtxEvo2yRZDSfy2LO3t--NfWfgaA' ] ] }
  # rubocop:enable Layout/LineLength

  post 'users/login' => 'sessions#create' # , #defaults: { format: :json
  post 'users/signup' => 'users/signups#create'

  get  'logout' => 'sessions#destroy'

  resources :sessions
  resource :account, only: [ :update, :destroy ]
  resource :profile, only: [ :show, :update ]

  resources :teams, only: [] do
    resources :ai_judges, only: [ :new, :create, :destroy ], controller: :ai_judges
  end

  resources :ai_judges, only: [] do
    resource :prompt, only: [ :edit, :update ], module: :ai_judges
  end

  resources :cases, only: [] do
    resource :book
    resources :ratings, only: [ :index ]
  end

  resources :books do
    resources :judgements
    resources :ai_judges
    resources :query_doc_pairs do
      resources :judgements
      post 'unrateable' => 'judgements#unrateable'
      patch 'unrateable' => 'judgements#unrateable'
      get 'judge_later' => 'judgements#judge_later'
    end
    get 'judge' => 'judgements#new'
    get 'skip_judging' => 'judgements#skip_judging'
    member do
      patch 'combine'
      patch 'assign_anonymous'
      patch 'run_judge_judy/:ai_judge_id', action: :run_judge_judy, as: :run_judge_judy
      delete 'delete_ratings_by_assignee', action: :delete_ratings_by_assignee, as: :delete_ratings_by_assignee
      delete 'reset_unrateable/:user_id', action: :reset_unrateable, as: :reset_unrateable
      delete 'reset_judge_later/:user_id', action: :reset_judge_later, as: :reset_judge_later
      delete 'delete_query_doc_pairs_below_position', action: :delete_query_doc_pairs_below_position,
                                                      as:     :delete_query_doc_pairs_below_position
      patch 'eric_steered_us_wrong',
            action: :eric_steered_us_wrong, as: :eric_steered_us_wrong
    end
  end

  namespace :books do
    resources :import, only: [ :new, :create ]
    resources :export, only: [ :update ], param: :book_id
  end

  devise_for :users, controllers: {
    passwords:          'users/passwords',
    invitations:        'users/invitations',
    omniauth_callbacks: 'users/omniauth_callbacks',
  }

  namespace :analytics do
    get 'tries_visualization/:case_id' => 'tries_visualization#show', as: :tries_visualization
    get 'tries_visualization/:case_id/vega_specification' => 'tries_visualization#vega_specification',
        as: :tries_visualization_vega_specification
    get 'tries_visualization/:case_id/vega_data' => 'tries_visualization#vega_data', as: :tries_visualization_vega_data
    resources :cases do
      resource :visibility, only: [ :update ], module: :cases
      resource :duplicate_scores, only: [ :show ], module: :cases
    end
    get 'sparkline/vega_specification' => 'sparkline#vega_specification',
        as: :sparkline_vega_specification
    get 'sparkline/vega_data' => 'sparkline#vega_data', as: :sparkline_vega_data
  end

  namespace :admin do
    get '/' => 'home#index'
    resources :users do
      resource :lock, only: [ :update ], module: :users
      resource :pulse, only: [ :show ], module: :users
      member do
        post :assign_judgements_to_anonymous_user
      end
    end
    resources :communal_scorers
    resources :announcements do
      member do
        post :publish
      end
    end
    resources :websocket_tester, only: [ :index ] do
      post 'test_background_job', on: :collection
    end
  end

  # preview routes for mailers
  if Rails.env.development?
    get '/rails/mailers' => 'rails/mailers#index'
    get '/rails/mailers/*path' => 'rails/mailers#preview'
  end

  namespace :api, defaults: { format: :json } do
    get 'test' => 'api#test'
    get 'test_exception' => 'api#test_exception'

    scope module: :v1, constraints: ApiConstraint.new(version: 1, default: true) do
      resources :users,   only: [ :index, :show, :update ] do
        get '/current' => 'current_user#show', on: :collection
      end
      resources :signups, only: [ :create ] if Rails.application.config.signup_enabled

      get '/dropdown/cases' => 'cases/dropdown#index'
      get '/dropdown/books' => 'books/dropdown#index'

      # Cases routes.
      # In order to be consistent and always user :case_id as the param for the
      # case instead of having the root APIs for cases use :id and the nested ones
      # user :case_id, we are overriding the param option.
      # But if we nest it with the overridden param option, then the nested
      # routes would get :case_case_id as the param, which is what we do not
      # want. Hence, the two declarations.
      # This simple setup helps use one before_filter to fetch the case by the
      # :case_id param instead of having multiple helpers to accommodate the
      # different scenarios.
      resources :cases, except: [ :new, :edit ], param: :case_id
      resources :cases, only: [] do
        # Case Tries
        resources :tries, param: :try_number, except: [ :new ] do
          post '/duplicate' => 'duplicate_tries#create', as: :duplicate_try
        end

        # Case Scorers
        resources :scorers, only: [ :index, :update ], controller: :case_scorers

        # Case Queries
        resources :queries, except: [ :new, :edit, :show ] do
          scope module: :queries do
            resource  :notes,     only: [ :show, :update ]
            resource  :options,   only: [ :show, :update ]
            resource  :position,  only: [ :update ]
            resource  :ratings,   only: [ :update, :destroy ] # not actually a singular resource, doc_id in json payload
          end

          resource :bulk, only: [] do
            resource :ratings, only: [ :update, :destroy ], controller: :bulk_ratings
            post '/ratings/delete' => 'bulk_ratings#destroy'
          end
        end

        # Case Snapshots
        resources :snapshots, except: [ :new, :edit, :update ] do
          scope module: :snapshots do
            resources :search, only: [ :index ]
          end
        end
        namespace :snapshots do
          resources :imports, only: [ :create ]
        end

        # Case Metadata/Scores
        resource :metadata, only: [ :update ], controller: :case_metadata
        resource :scores, only: [ :update, :show ], controller: :case_scores
        get '/scores/all' => 'case_scores#index'

        resources :annotations, except: [ :show ]

        resources :search_endpoints, only: [ :index ]
      end

      resources :books do
        put '/populate' => 'books/populate#update'
        resources :cases do
          put 'refresh' => 'books/refresh#update'
        end
        resources :query_doc_pairs do
          collection do
            get 'to_be_judged/:judge_id' => 'query_doc_pairs#to_be_judged'
          end
        end
        resources :judgements
      end

      namespace :clone do
        resources :cases, only: [ :create ] do
          post 'tries/:try_number' => 'tries#create', as: :try
        end
      end

      resources :search_endpoints
      resources :scorers, except: [ :new, :edit ]

      resources :teams, except: [ :new, :edit ], param: :team_id
      resources :teams, only: [] do
        resources :members, only: [ :index, :create, :destroy ], controller: :team_members
        post '/members/invite' => 'team_members#invite'
        resources :scorers, only: [ :index, :create, :destroy ], controller: :team_scorers
        resources :cases,   only: [ :index, :create, :destroy ], controller: :team_cases
        resources :owners,  only: [ :update ], controller: :team_owners
        resources :books,   only: [ :index ], controller: :team_books
        resources :search_endpoints, only: [ :index ]
      end

      # Imports
      namespace :import do
        resources :books, only: [ :create ]
        resources :cases, only: [ :create ]
        resources :ratings, only: [ :create ]
        namespace :queries do
          resources :information_needs, only: [ :create ], param: :case_id
        end
      end

      # Exports
      namespace :export do
        resources :books, only: [ :update ], param: :book_id
        resources :cases, only: [ :show ], param: :case_id # should be post (:update)
        resources :ratings, only: [ :show ], param: :case_id # should be post (:update)
        namespace :queries do
          resources :information_needs, only: [ :show ], param: :case_id # should be post (:update)
        end
      end

      namespace :bulk do
        resources :cases, only: [] do
          resources :queries, only: [ :create ]
          delete '/queries/delete' => 'queries#destroy'
        end
      end
    end
  end

  # Routes handled by angular
  get '/case/:id(/try/:try_number)'   => 'core#index', as: :case_core
  get '/cases/new'                    => 'core#new', as: :case_new
  get '/cases'                        => 'core#index'
  get '/case'                         => 'core#index'
  get '/cases/import'                 => 'core#index'
  get '/teams(/:id)'                  => 'core#teams', as: :teams_core
  get '/scorers'                      => 'core#index'

  # Static pages
  get '*page' => 'pages#show'
end
# rubocop:enable Metrics/BlockLength
