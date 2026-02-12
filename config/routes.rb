# frozen_string_literal: true

# rubocop:disable Metrics/BlockLength
Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  mount ActionCable.server => '/cable'
  mount ActiveStorageDB::Engine => '/active_storage_db'
  mount OasRails::Engine => '/api/docs'

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
  get 'home/book_summary_detail/:book_id', to: 'home#book_summary_detail', as: :home_book_summary_detail

  get 'proxy/fetch'
  post 'proxy/fetch'

  resources :api_keys, path: 'api-keys', only: [ :create, :destroy ]

  # Mapper Wizard routes MUST be defined before resources :search_endpoints
  # to prevent /search_endpoints/mapper_wizard from matching search_endpoints#show with id='mapper_wizard'
  scope 'search_endpoints' do
    get 'mapper_wizard', to: 'mapper_wizards#show', as: :new_mapper_wizard
    get ':search_endpoint_id/mapper_wizard', to: 'mapper_wizards#show', as: :mapper_wizard
    post ':search_endpoint_id/mapper_wizard/fetch_html', to: 'mapper_wizards#fetch_html', as: :mapper_wizard_fetch_html
    post ':search_endpoint_id/mapper_wizard/generate_mappers', to: 'mapper_wizards#generate_mappers',
                                                               as: :mapper_wizard_generate_mappers
    post ':search_endpoint_id/mapper_wizard/test_mapper', to: 'mapper_wizards#test_mapper', as: :mapper_wizard_test_mapper
    post ':search_endpoint_id/mapper_wizard/refine_mapper', to: 'mapper_wizards#refine_mapper',
                                                            as: :mapper_wizard_refine_mapper
    post ':search_endpoint_id/mapper_wizard/save', to: 'mapper_wizards#save', as: :mapper_wizard_save
  end

  resources :search_endpoints do
    member do
      get 'clone'
      post 'archive'
    end
  end

  # let's encrypt verification (can be removed in the future)
  get '.well-known/acme-challenge/9IWOgATbRmEtWKsOOJQ-E4-lrIT9tHsHv_9bl5Zt6fI', to: proc {
    [ 200, {}, [ '9IWOgATbRmEtWKsOOJQ-E4-lrIT9tHsHv_9bl5Zt6fI.fDzklrX7i2PRMRsPtxEvo2yRZDSfy2LO3t--NfWfgaA' ] ]
  }
  post 'users/login' => 'sessions#create' # , #defaults: { format: :json
  post 'users/signup' => 'users/signups#create'

  get  'logout' => 'sessions#destroy'

  resources :sessions, except: [ :edit, :show, :update ]
  resource :account, only: [ :update, :destroy ]
  resource :profile, only: [ :show, :update ]

  resources :scorers, only: [ :index, :new, :create, :edit, :update, :destroy ] do
    post :clone, on: :member
  end
  post '/scorers/default' => 'scorers#update_default', as: :update_default_scorers
  post '/scorers/share' => 'scorers#share', as: :share_scorers
  post '/scorers/unshare' => 'scorers#unshare', as: :unshare_scorers

  get '/dropdown/cases' => 'dropdown#cases'
  get '/dropdown/books' => 'dropdown#books'

  resources :teams, only: [] do
    resources :ai_judges, controller: :ai_judges, except: [ :index ]
  end

  resources :ai_judges, only: [] do
    resource :prompt, only: [ :show, :edit, :update ], module: :ai_judges
  end

  resources :cases, only: [] do
    resource :book
    resources :ratings, only: [ :index ]
    resources :scores, only: [ :index ] do
      collection do
        delete :destroy_multiple
      end
    end
  end

  resources :books do
    resources :judgements
    resources :ai_judges, except: [ :index ]
    resources :query_doc_pairs do
      resources :judgements
      post 'unrateable' => 'judgements#unrateable'
      patch 'unrateable' => 'judgements#unrateable'
      get 'judge_later' => 'judgements#judge_later'
    end
    get 'judge' => 'judgements#new'
    get 'judge/bulk' => 'bulk_judge#new'
    post 'judge/bulk/save' => 'bulk_judge#save'
    delete 'judge/bulk/delete' => 'bulk_judge#destroy'
    get 'skip_judging' => 'judgements#skip_judging'
    member do
      get 'judgement_stats'
      get 'export'
      patch 'combine'
      patch 'archive'
      patch 'unarchive'
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
    resources :import, only: [ :new, :create, :edit ]
    resources :export, only: [ :update ], param: :book_id
  end

  devise_for :users, controllers: {
    passwords:          'users/passwords',
    invitations:        'users/invitations',
    omniauth_callbacks: 'users/omniauth_callbacks',
  }

  # not sure we actually need this name space...
  namespace :analytics do
    get 'tries_visualization/:case_id' => 'tries_visualization#show', as: :tries_visualization
    get 'tries_visualization/:case_id/vega_specification' => 'tries_visualization#vega_specification',
        as: :tries_visualization_vega_specification
    get 'tries_visualization/:case_id/vega_data' => 'tries_visualization#vega_data', as: :tries_visualization_vega_data
    resources :cases, only: [] do
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
    resources :announcements, except: [ :show ] do
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
      resources :cases, except: [ :new, :edit ], param: :case_id do
        member do
          post 'run_evaluation'
        end
      end
      resources :cases, only: [] do
        # Case Tries
        resources :tries, param: :try_number, except: [ :new, :edit ]

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

        resources :annotations, except: [ :show, :new, :edit ]

        resources :search_endpoints, only: [ :index ]
      end

      resources :books, except: [ :new, :edit ] do
        put '/populate' => 'books/populate#update'
        put '/cases/:case_id/refresh' => 'books/refresh#update', as: :refresh
        resources :query_doc_pairs, except: [ :new, :edit ] do
          collection do
            get 'to_be_judged/:judge_id' => 'query_doc_pairs#to_be_judged'
          end
        end
        resources :judgements, except: [ :new, :edit ]
      end

      namespace :clone do
        resources :cases, only: [ :create ] do
          post 'tries/:try_number' => 'tries#create', as: :try
        end
      end

      resources :search_endpoints, except: [ :new, :edit ]
      resources :scorers, except: [ :new, :edit ]

      resources :teams, except: [ :new, :edit ], param: :team_id
      resources :teams, only: [] do
        resources :members, only: [ :index, :create, :destroy ], controller: :team_members
        post '/members/invite' => 'team_members#invite'
        resources :scorers, only: [ :index, :create, :destroy ], controller: :team_scorers
        resources :cases,   only: [ :index, :create, :destroy ], controller: :team_cases
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
  # Server-side comparison routes for Teams (preserve Angular route below)
  get '/teams2'                       => 'teams2#index', as: :teams2
  get '/teams2/new'                   => 'teams2#new',   as: :new_team2
  post '/teams2'                      => 'teams2#create'
  get '/teams2/:id'                   => 'teams2#show', as: :team2
  post '/teams2/:id/rename'           => 'teams2#rename', as: :team2_rename
  post '/teams2/:id/members'          => 'teams2#add_member', as: :team2_members
  delete '/teams2/:id/members/:member_id' => 'teams2#remove_member', as: :team2_member
  delete '/teams2/:id/cases/:case_id' => 'teams2#remove_case', as: :team2_case
  post   '/teams2/:id/cases/:case_id/archive' => 'teams2#archive_case', as: :team2_archive_case
  post   '/teams2/:id/cases/:case_id/unarchive' => 'teams2#unarchive_case', as: :team2_unarchive_case
  post   '/teams2/:id/search_endpoints/:search_endpoint_id/archive' => 'teams2#archive_search_endpoint', as: :team2_archive_search_endpoint
  post   '/teams2/:id/search_endpoints/:search_endpoint_id/unarchive' => 'teams2#unarchive_search_endpoint', as: :team2_unarchive_search_endpoint
  post '/teams2/cases/share' => 'teams2#share_case', as: :share_case
  post '/teams2/cases/unshare' => 'teams2#unshare_case', as: :unshare_case
  post '/teams2/books/share' => 'teams2#share_book', as: :share_book
  post '/teams2/books/unshare' => 'teams2#unshare_book', as: :unshare_book
  post '/teams2/search_endpoints/share' => 'teams2#share_search_endpoint', as: :share_search_endpoint
  post '/teams2/search_endpoints/unshare' => 'teams2#unshare_search_endpoint', as: :unshare_search_endpoint

  get '/teams(/:id)' => 'core#teams', as: :teams_core

  # Static pages
  get '/cookies' => 'pages#show', defaults: { page: 'cookies' }
end
# rubocop:enable Metrics/BlockLength
