# frozen_string_literal: true

require 'action_controller'
require 'faraday'
require 'faraday/follow_redirects'

class QueryRunnerJob < ApplicationJob
  queue_as :bulk_processing

  # rubocop:disable Metrics/MethodLength
  def perform acase, atry
    query_count = acase.queries.count

    options = {
      fake_mode:      false,
      debug_mode:     true,
      snapshot_limit: 10,
    }

    fetch_service = FetchService.new options
    fetch_service.begin(acase, atry)

    acase.queries.each_with_index do |query, counter|
      response = fetch_service.make_request(atry, query)

      response_code = response.status
      response_body = response.body
      puts "Does response_code == 200?  #{response_code} is #{200 == response_code}"
      if 200 == response_code
        puts 'WE GOT A 200'
        # this is all rough...  just to get some snapshot_docs...
        docs = fetch_service.extract_docs_from_response_body_for_solr response_body
        fetch_service.store_query_results query, docs, response_code, response_body
      end

      Turbo::StreamsChannel.broadcast_render_to(
        :notifications,
        target:  'notifications',
        partial: 'admin/query_runner/notification',
        locals:  { query: query, query_count: query_count, counter: counter }
      )

      Turbo::StreamsChannel.broadcast_render_to(
        :notifications,
        target:  "notifications-case-#{acase.id}",
        partial: 'admin/query_runner/notification_case',
        locals:  { acase: acase, query: query, query_count: query_count, counter: counter }
      )
    end

    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'admin/query_runner/notification',
      locals:  { query: nil, query_count: query_count, counter: -1 }
    )

    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  "notifications-case-#{acase.id}",
      partial: 'admin/query_runner/notification_case',
      locals:  { acase: acase, query: nil, query_count: query_count, counter: -1 }
    )

    fetch_service.complete
  end
  # rubocop:enable Metrics/MethodLength
end
