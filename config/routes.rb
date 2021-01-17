# frozen_string_literal: true

require 'sidekiq/web'

# rubocop:disable Metrics/BlockLength
Rails.application.routes.draw do
  get 'bob/open'
  get 'bob/show'
  constraints(AdminConstraint) do
    mount Sidekiq::Web, at: 'admin/jobs'
  end

  # rubocop:disable Layout/LineLength
  # let's encrypt verification (can be removed in the future)
  get '.well-known/acme-challenge/9IWOgATbRmEtWKsOOJQ-E4-lrIT9tHsHv_9bl5Zt6fI', to: proc { [ 200, {}, [ '9IWOgATbRmEtWKsOOJQ-E4-lrIT9tHsHv_9bl5Zt6fI.fDzklrX7i2PRMRsPtxEvo2yRZDSfy2LO3t--NfWfgaA' ] ] }
  # rubocop:enable Layout/LineLength

  # legacy routes for angular single page app
  post 'users/login' => 'sessions#create', defaults: { format: :json }
  get  'logout'      => 'sessions#destroy'
  get  'secure'      => 'secure#index'
  get  'secure/complete' => 'secure#index'
  # end legacy routes

  resources :sessions
  resource :account, only: [ :update ]
  resource :profile, only: [ :show, :update ]

  # not sure I get why we had the only: [ :passwords ] clause
  devise_for :users, controllers: {
    passwords:   'users/passwords',
    invitations: 'users/invitations',
  }
  # devise_for :users, only: [ :passwords ], controllers: {
  #  passwords: 'users/passwords',
  #  invitations: 'users/invitations'
  # }

  namespace :admin do
    get '/' => 'home#index'
    resources :users, except: [ :new, :create, :destroy ] do
      resource :lock, only: [ :update ], module: :users
      resource :pulse, only: [ :show ], module: :users
    end
    resources :communal_scorers, except: [ :destroy ]
  end

  root 'home#index'

  # preview routes for mailers
  if Rails.env.development?
    get '/rails/mailers' => 'rails/mailers#index'
    get '/rails/mailers/*path' => 'rails/mailers#preview'
  end

  namespace :api, defaults: { format: :json } do
    get 'test' => 'api#test'

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
            resource  :scorer,    only: [ :show, :update, :destroy ]
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
      end

      # Imports
      namespace :import do
        resources :ratings, only: [ :create ]
      end

      # Exports
      namespace :export do
        resources :ratings, only: [ :show ], param: :case_id
      end

      namespace :bulk do
        resources :cases, only: [] do
          resources :queries, only: [ :create ]
        end
      end
    end
  end

  # Routes handled by angular
  get '/case/:id(/try/:id(/curate))'  => 'home#index'
  get '/cases'                        => 'home#index'
  get '/cases/import'                 => 'home#index'
  get '/teams(/:id)'                  => 'home#index'
  get '/advanced'                     => 'home#index'

  # Static pages
  get '*page' => 'pages#show'
end
# rubocop:enable Metrics/BlockLength
