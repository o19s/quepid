# frozen_string_literal: true

require 'faraday'
require 'faraday/follow_redirects'

class RunCaseEvaluationJob < ApplicationJob
  queue_as :bulk_processing

  # for now let's minimize simultaneous jobs, but we can wait a long time before running them.
  limits_concurrency to: 2, key: self.class.name, duration: 12.hours

  def perform acase, atry, user: nil
    raise ArgumentError, "Try #{atry.id} has no search endpoint" unless atry.search_endpoint

    @fetch_service = initialize_fetch_service
    @fetch_service.begin(acase, atry)

    process_case_queries(acase, atry)

    @fetch_service.score_run(user)

    broadcast_completion_notifications(acase, acase.queries.count, user: user)

    @fetch_service.complete
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

  def process_case_queries acase, atry
    query_count = acase.queries.count

    acase.queries.each_with_index do |query, counter|
      process_single_query(query, atry)
      broadcast_progress_notifications(acase, query, query_count, counter)
    end
  end

  def process_single_query query, atry
    response = @fetch_service.make_request(atry, query)
    response_code = response.status
    response_body = response.body

    docs = extract_docs_if_successful(response_code, response_body, atry)

    @fetch_service.store_query_results(query, docs, response_code, response_body)
  end

  def extract_docs_if_successful response_code, response_body, atry
    return [] unless 200 == response_code

    search_endpoint = atry.search_endpoint
    extract_docs_based_on_engine(search_endpoint, response_body)
  end

  def extract_docs_based_on_engine search_endpoint, response_body
    case search_endpoint.search_engine.to_sym
    when :solr
      @fetch_service.extract_docs_from_response_body_for_solr(response_body)
    when :es
      @fetch_service.extract_docs_from_response_body_for_es(response_body)
    when :os
      @fetch_service.extract_docs_from_response_body_for_os(response_body)

    when :searchapi
      @fetch_service.extract_docs_from_response_body_for_searchapi(
        search_endpoint.mapper_code,
        response_body
      )
    when :vectara
      @fetch_service.extract_docs_from_response_body_for_vectara(response_body)
    when :algolia
      @fetch_service.extract_docs_from_response_body_for_algolia(response_body)
    else
      raise "Search engine #{search_endpoint.search_engine} is not supported."
    end
  end

  def broadcast_progress_notifications acase, query, query_count, counter
    broadcast_general_notification(query, query_count, counter)
    broadcast_case_specific_notification(acase, query, query_count, counter)
  end

  def broadcast_completion_notifications acase, query_count, user: nil
    broadcast_general_notification(nil, query_count, -1)
    broadcast_case_specific_notification(acase, nil, query_count, -1)
    broadcast_score_update(acase)
    broadcast_query_list_update(acase, user)
  end

  def broadcast_score_update acase
    last_score = acase.last_score
    score_val = last_score&.score || '?'
    max_score = acase.scorer&.scale&.last || 100
    Turbo::StreamsChannel.broadcast_replace_to(
      :notifications,
      target:  "qscore-case-#{acase.id}",
      partial: 'core/scores/qscore_case',
      locals:  {
        case_id:     acase.id,
        score:       score_val,
        max_score:   max_score,
        score_label: acase.scorer&.name,
        scores:      acase.scores.order(updated_at: :desc).limit(10).map { |s| { score: s.score, updated_at: s.updated_at.iso8601 } },
        annotations: acase.annotations.map { |a| { message: a.message, updated_at: a.updated_at.iso8601 } },
      }
    )
    Turbo::StreamsChannel.broadcast_replace_to(
      :notifications,
      target:  "case-header-score-#{acase.id}",
      partial: 'core/scores/case_header_score',
      locals:  { case_id: acase.id, score: score_val }
    )
  end

  def broadcast_query_list_update acase, user
    atry = acase.tries.latest
    last_score = acase.last_score
    query_scores = last_score&.queries.is_a?(Hash) ? last_score.queries : {}
    other_cases = if user
                    user.cases_involved_with.where.not(id: acase.id).order(:case_name)
                      .pluck(:id, :case_name).map { |id, name| { id: id, case_name: name } }
                  else
                    []
                  end

    Turbo::StreamsChannel.broadcast_replace_to(
      :notifications,
      target:  "query_list_#{acase.id}",
      partial: 'core/scores/query_list',
      locals:  {
        case_id:           acase.id,
        try_number:        atry&.try_number,
        queries:           acase.queries,
        selected_query_id: nil,
        other_cases:       other_cases,
        scorer_scale_max:  acase.scorer&.scale&.last || 100,
        query_scores:      query_scores,
        sortable:          Rails.application.config.query_list_sortable,
      }
    )
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
