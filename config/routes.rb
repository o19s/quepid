# frozen_string_literal: true

require 'sidekiq/web'

# rubocop:disable Metrics/BlockLength
Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  Healthcheck.routes(self)
  constraints(AdminConstraint) do
    mount Sidekiq::Web, at: 'admin/jobs'
  end

  # rubocop:disable Layout/LineLength
  # let's encrypt verification (can be removed in the future)
  get '.well-known/acme-challenge/9IWOgATbRmEtWKsOOJQ-E4-lrIT9tHsHv_9bl5Zt6fI', to: proc { [ 200, {}, [ '9IWOgATbRmEtWKsOOJQ-E4-lrIT9tHsHv_9bl5Zt6fI.fDzklrX7i2PRMRsPtxEvo2yRZDSfy2LO3t--NfWfgaA' ] ] }
  # rubocop:enable Layout/LineLength

  post 'users/login' => 'sessions#create' # , #defaults: { format: :json
  post 'users/signup' => 'users/signups#create'

  get  'logout' => 'sessions#destroy'

  resources :sessions
  resource :account, only: [ :update, :destroy ]
  resource :profile, only: [ :show, :update ]

  resources :cases, only: [] do
    resource :book
  end

  resources :books do
    resources :judgements
    resources :query_doc_pairs do
      resources :judgements
      get 'unrateable' => 'judgements#unrateable'
    end
    get 'judge' => 'judgements#new'
    get 'skip_judging' => 'judgements#skip_judging'
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
    end
  end

  namespace :admin do
    get '/' => 'home#index'
    resources :users, except: [ :new, :create ] do
      resource :lock, only: [ :update ], module: :users
      resource :pulse, only: [ :show ], module: :users
    end
    resources :communal_scorers
  end

  root 'core#index'

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
            resource  :threshold, only: [ :update ]
            resource  :ratings,   only: [ :update, :destroy ] # not actually a singular resource, doc_id in json payload
          end

          resource :bulk, only: [] do
            resource :ratings, only: [ :update, :destroy ], controller: :bulk_ratings
            post '/ratings/delete' => 'bulk_ratings#destroy'
          end
        end

        # Case Snapshots
        resources :snapshots, except: [ :new, :edit, :update ]
        namespace :snapshots do
          resources :imports, only: [ :create ]
        end

        # Case Metadata/Scores
        resource :metadata, only: [ :update ], controller: :case_metadata
        resource :scores, only: [ :index, :update, :show ], controller: :case_scores
        get '/scores/all' => 'case_scores#index'

        resources :annotations, except: [ :show ]
      end

      resources :books, only: [ :show ] do
        put '/populate' => 'books/populate#update'
        resources :cases do
          put 'refresh' => 'books/refresh#update'
        end
      end

      namespace :clone do
        resources :cases, only: [ :create ] do
          post 'tries/:try_number' => 'tries#create', as: :try
        end
      end

      resources :scorers, except: [ :new, :edit ]

      resources :teams, except: [ :new, :edit ], param: :team_id
      resources :teams, only: [] do
        resources :members, only: [ :index, :create, :destroy ], controller: :team_members
        post '/members/invite' => 'team_members#invite'
        resources :scorers, only: [ :index, :create, :destroy ], controller: :team_scorers
        resources :cases,   only: [ :index, :create, :destroy ], controller: :team_cases
        resources :owners,  only: [ :update ], controller: :team_owners
        resources :books,   only: [ :index ], controller: :team_books
      end

      # Imports
      namespace :import do
        resources :ratings, only: [ :create ]
        namespace :queries do
          resources :information_needs, only: [ :create ], param: :case_id
        end
      end

      # Exports
      namespace :export do
        resources :ratings, only: [ :show ], param: :case_id
        namespace :queries do
          resources :information_needs, only: [ :show ], param: :case_id
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
  get '/cases'                        => 'core#index'
  get '/case'                         => 'core#index'
  get '/cases/import'                 => 'core#index'
  get '/teams(/:id)'                  => 'core#index', as: :teams
  get '/scorers'                      => 'core#index'

  # Static pages
  # get '*page' => 'pages#show'
end
# rubocop:enable Metrics/BlockLength
