# frozen_string_literal: true

class SimulateBackgroundJob < ApplicationJob
  queue_as :default

  def perform
    30.downto(0) do |counter|
      Turbo::StreamsChannel.broadcast_render_to(
        :notifications,
        target:  'notifications',
        partial: 'websocket_tester/notification',
        locals:  { counter: counter }
      )

      puts "SimulateBackgroundJob: #{counter} seconds remaining"
      sleep(1)
    end
  end
end
