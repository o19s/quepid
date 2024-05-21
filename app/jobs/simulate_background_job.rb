# frozen_string_literal: true

class SimulateBackgroundJob < ApplicationJob
  queue_as :default

  def perform
    300.downto(1) do |counter|
      Turbo::StreamsChannel.broadcast_render_to(
        :notifications,
        target:  'notifications',
        partial: 'websocket/notification',
        locals:  { counter: counter }
      )

      puts "SimulateBackgroundJob: #{counter} seconds remaining"
      sleep(1)
    end
  end
end
