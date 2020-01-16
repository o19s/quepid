# frozen_string_literal: true

require 'sidekiq/web'

# rubocop:disable Metrics/BlockLength
Rails.application.routes.draw do
  constraints(AdminConstraint) do
    mount Sidekiq::Web, at: 'admin/jobs'
  end

  # rubocop:disable Metrics/LineLength
  # let's encrypt verification (can be removed in the future)
  get '.well-known/acme-challenge/9IWOgATbRmEtWKsOOJQ-E4-lrIT9tHsHv_9bl5Zt6fI', to: proc { [ 200, {}, [ '9IWOgATbRmEtWKsOOJQ-E4-lrIT9tHsHv_9bl5Zt6fI.fDzklrX7i2PRMRsPtxEvo2yRZDSfy2LO3t--NfWfgaA' ] ] }
  # rubocop:enable Metrics/LineLength

  # legacy routes for angular single page app
  post 'users/login' => 'sessions#create', defaults: { format: :json }
  get  'logout'      => 'sessions#destroy'
  get  'secure'      => 'secure#index'
  # end legacy routes

  resources :sessions
  resource :account, only: [ :update ]
  resource :profile, only: %i[show update]

  devise_for :users, only: [ :passwords ], controllers: {
    passwords: 'users/passwords',
  }

  namespace :admin do
    get '/' => 'home#index'
    resources :users, except: %i[new create destroy] do
      resource :lock, only: [ :update ], module: :users
      resource :pulse, only: [ :show ], module: :users
    end
    resources :default_scorers, except: [ :destroy ]
  end

  root 'home#index'

  # preview routes for mailers
  if 'development' == Rails.env
    get '/rails/mailers' => 'rails/mailers#index'
    get '/rails/mailers/*path' => 'rails/mailers#preview'
  end

  namespace :api, defaults: { format: :json } do
    get 'test' => 'api#test'

    scope module: :v1, constraints: ApiConstraint.new(version: 1, default: true) do
      resources :users,   only: %i[index show update] do
        get '/current' => 'current_user#show', on: :collection
      end
      resources :signups, only: [ :create ]

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
      resources :cases, except: %i[new edit], param: :case_id
      resources :cases, only: [] do
        # Case Tries
        resources :tries, param: :try_number, except: %i[new edit] do
          post '/duplicate' => 'duplicate_tries#create', as: :duplicate_try
        end

        # Case Scorers
        resources :scorers, only: %i[index update], controller: :case_scorers

        # Case Queries
        resources :queries, except: %i[new edit show] do
          scope module: :queries do
            resource  :notes,     only: %i[show update]
            resource  :options,   only: %i[show update]
            resource  :position,  only: [ :update ]
            resource  :scorer,    only: %i[show update destroy]
            resource  :threshold, only: [ :update ]
            resources :ratings,   only: %i[update destroy], param: :doc_id
          end

          resource :bulk, only: [] do
            resource :ratings, only: %i[update destroy], controller: :bulk_ratings
            post '/ratings/delete' => 'bulk_ratings#destroy'
          end
        end

        # Case Snapshots
        resources :snapshots, except: %i[new edit update]
        namespace :snapshots do
          resources :imports, only: [ :create ]
        end

        # Case Metadata/Scores
        resource :metadata, only: [ :update ], controller: :case_metadata
        resource :scores, only: %i[index update show], controller: :case_scores
        get '/scores/all' => 'case_scores#index'

        resources :annotations, except: [ :show ]
      end

      namespace :clone do
        resources :cases, only: [ :create ] do
          post 'tries/:try_number' => 'tries#create', as: :try
        end
      end

      resources :scorers, except: %i[new edit]

      resources :teams, except: %i[new edit], param: :team_id
      resources :teams, only: [] do
        resources :members, only: %i[index create destroy], controller: :team_members
        resources :scorers, only: %i[index create destroy], controller: :team_scorers
        resources :cases,   only: %i[index create destroy], controller: :team_cases
        resources :owners,  only: [ :update ], controller: :team_owners
      end

      # Imports
      namespace :import do
        resources :ratings, only: [ :create ]
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
