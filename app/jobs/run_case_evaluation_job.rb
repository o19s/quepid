# frozen_string_literal: true

require 'faraday'
require 'faraday/follow_redirects'

class RunCaseEvaluationJob < ApplicationJob
  queue_as :bulk_processing

  def perform acase, atry, auser: nil
    fetch_service = initialize_fetch_service
    fetch_service.begin(acase, atry)

    process_case_queries(acase, atry, fetch_service)

    fetch_service.score_run(auser)

    broadcast_completion_notifications(acase, acase.queries.count)

    fetch_service.complete
  end

  private

  def initialize_fetch_service
    options = {
      fake_mode:      false,
      debug_mode:     false,
      snapshot_limit: 10,
    }

    FetchService.new(options)
  end

  def process_case_queries acase, atry, fetch_service
    query_count = acase.queries.count

    acase.queries.each_with_index do |query, counter|
      process_single_query(query, atry, fetch_service)
      broadcast_progress_notifications(acase, query, query_count, counter)
    end
  end

  def process_single_query query, atry, fetch_service
    response = fetch_service.make_request(atry, query)
    response_code = response.status
    response_body = response.body

    docs = extract_docs_if_successful(response_code, response_body, atry)

    fetch_service.store_query_results(query, docs, response_code, response_body)
  end

  def extract_docs_if_successful response_code, response_body, atry
    return [] unless 200 == response_code

    search_endpoint = atry.search_endpoint
    extract_docs_based_on_engine(search_endpoint, response_body)
  end

  def extract_docs_based_on_engine search_endpoint, response_body
    case search_endpoint.search_engine.to_sym
    when :solr
      fetch_service.extract_docs_from_response_body_for_solr(response_body)
    when :searchapi
      fetch_service.extract_docs_from_response_body_for_searchapi(
        search_endpoint.mapper_code,
        response_body
      )
    else
      raise "Search engine #{search_endpoint.search_engine} is not supported."
    end
  end

  def broadcast_progress_notifications acase, query, query_count, counter
    broadcast_general_notification(query, query_count, counter)
    broadcast_case_specific_notification(acase, query, query_count, counter)
  end

  def broadcast_completion_notifications acase, query_count
    broadcast_general_notification(nil, query_count, -1)
    broadcast_case_specific_notification(acase, nil, query_count, -1)
  end

  def broadcast_general_notification query, query_count, counter
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'admin/run_case/notification',
      locals:  { query: query, query_count: query_count, counter: counter }
    )
  end

  def broadcast_case_specific_notification acase, query, query_count, counter
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  "notifications-case-#{acase.id}",
      partial: 'admin/run_case/notification_case',
      locals:  { acase: acase, query: query, query_count: query_count, counter: counter }
    )
  end
end
