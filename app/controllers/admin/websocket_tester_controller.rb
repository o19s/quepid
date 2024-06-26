# frozen_string_literal: true

module Admin
  class WebsocketTesterController < ApplicationController
    def index
      @action_cable_settings = {
        'config/cable.yml'          => Rails.configuration.action_cable.to_hash,
        'config/environments/*.rb'  => {
          development: Rails.configuration.action_cable.to_hash,
          test:        Rails.configuration.action_cable.to_hash,
          production:  Rails.configuration.action_cable.to_hash,
        },
        'app/channels/*_channel.rb' => {
          # You can introspect your channels here
        },
      }
    end

    def test_background_job
      WebsocketTesterBackgroundJob.perform_later
      redirect_to admin_websocket_tester_index_path, notice: 'Websocker Tester Background Job was queued up.'
    end
  end
end
