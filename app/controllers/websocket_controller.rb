class WebsocketController < ApplicationController
  skip_before_action :require_login              
  skip_before_action :check_current_user_locked!
  skip_before_action :verify_authenticity_token
  def index
  @action_cable_settings = {
        'config/cable.yml' => Rails.configuration.action_cable.to_hash,
        'config/environments/*.rb' => {
          development: Rails.configuration.action_cable.to_hash,
          test: Rails.configuration.action_cable.to_hash,
          production: Rails.configuration.action_cable.to_hash
        },        
        'app/channels/*_channel.rb' => {
          # You can introspect your channels here
        }
  }
  end
  
  
  def simulate_background_job
    SimulateBackgroundJob.perform_later 
    redirect_to websocket_path, notice: 'SimulateBackgroundJob was queued up.'
  end
end
