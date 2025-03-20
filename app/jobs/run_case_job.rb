# frozen_string_literal: true

# require 'action_controller'
require 'faraday'
require 'faraday/follow_redirects'

class RunCaseJob < ApplicationJob
  queue_as :bulk_processing

  # rubocop:disable Metrics/MethodLength
  def perform acase, atry, auser: nil
    query_count = acase.queries.count

    options = {
      fake_mode:      false,
      debug_mode:     false,
      snapshot_limit: 10,
    }

    fetch_service = FetchService.new options
    fetch_service.begin(acase, atry)

    acase.queries.each_with_index do |query, counter|
      response = fetch_service.make_request(atry, query)

      response_code = response.status
      response_body = response.body
      # need to deal with errors better.
      docs = []
      if 200 == response_code
        search_endpoint = atry.search_endpoint
        case search_endpoint.search_engine.to_sym
        when :solr
          docs = fetch_service.extract_docs_from_response_body_for_solr response_body
        when :searchapi
          docs = fetch_service.extract_docs_from_response_body_for_searchapi search_endpoint.mapper_code,
                                                                             response_body
        else
          # Handle when none of the above or nil
          raise "Search engine #{search_endpoint.search_engine} is not supported."
        end
      end

      fetch_service.store_query_results query, docs, response_code, response_body

      Turbo::StreamsChannel.broadcast_render_to(
        :notifications,
        target:  'notifications',
        partial: 'admin/run_case/notification',
        locals:  { query: query, query_count: query_count, counter: counter }
      )

      Turbo::StreamsChannel.broadcast_render_to(
        :notifications,
        target:  "notifications-case-#{acase.id}",
        partial: 'admin/run_case/notification_case',
        locals:  { acase: acase, query: query, query_count: query_count, counter: counter }
      )
    end

    fetch_service.score_run auser

    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'admin/run_case/notification',
      locals:  { query: nil, query_count: query_count, counter: -1 }
    )

    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  "notifications-case-#{acase.id}",
      partial: 'admin/run_case/notification_case',
      locals:  { acase: acase, query: nil, query_count: query_count, counter: -1 }
    )

    fetch_service.complete
  end
  # rubocop:enable Metrics/MethodLength
end
