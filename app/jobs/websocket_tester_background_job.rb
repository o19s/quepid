# frozen_string_literal: true

class WebsocketTesterBackgroundJob < ApplicationJob
  queue_as :bulk_processing

  def perform user
    30.downto(0) do |counter|
      Turbo::StreamsChannel.broadcast_render_to(
        user, :notifications,
        target:  'notifications',
        partial: 'admin/websocket_tester/notification',
        locals:  { counter: counter }
      )

      puts "WebsocketTesterBackgroundJob: #{counter} seconds remaining"
      sleep(1)
    end
  end
end
