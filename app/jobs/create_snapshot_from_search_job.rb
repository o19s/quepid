# frozen_string_literal: true

# Populates a snapshot by fetching search results from the try's search endpoint.
# Used when the client sends only snapshot name (no docs) — e.g. Take Snapshot from
# the modern Stimulus workspace. Runs fetch + score, similar to RunCaseEvaluationJob
# but for a user-named snapshot.
#
# @see Api::V1::SnapshotsController#create (server-side flow when docs not provided)
# @see docs/legacy_assets_remaining.md (TakeSnapshotCtrl migration)
class CreateSnapshotFromSearchJob < ApplicationJob
  queue_as :bulk_processing

  limits_concurrency to: 2, key: self.class.name, duration: 12.hours

  def perform snapshot, user: nil, record_document_fields: true
    acase = snapshot.case
    atry = snapshot.try || acase.tries.first

    if atry.nil? || atry.search_endpoint.nil?
      Rails.logger.warn "CreateSnapshotFromSearchJob: No try or search endpoint for snapshot #{snapshot.id} (case #{acase.id})"
      return
    end

    @record_document_fields = record_document_fields
    @fetch_service = FetchService.new(fake_mode: false, debug_mode: false)
    @fetch_service.use_existing_snapshot(snapshot, acase, atry)

    process_case_queries(acase, atry)
    @fetch_service.score_run(user)
  end

  private

  def process_case_queries acase, atry
    acase.queries.each do |query|
      process_single_query(query, atry)
    end
  end

  def process_single_query query, atry
    response = @fetch_service.make_request(atry, query)
    response_code = response.status
    response_body = response.body

    Rails.logger.warn "CreateSnapshotFromSearchJob: Search returned #{response_code} for query #{query.id} (#{query.query_text})" unless 200 == response_code

    docs = extract_docs_if_successful(response_code, response_body, atry)
    docs = strip_doc_fields(docs) unless @record_document_fields
    @fetch_service.store_query_results(query, docs, response_code, response_body)
  end

  # FetchService extract methods return docs with symbol keys (:id, :fields, etc.)
  def strip_doc_fields docs
    docs.map { |doc| doc.except(:fields, 'fields') }
  end

  def extract_docs_if_successful response_code, response_body, atry
    return [] unless 200 == response_code

    search_endpoint = atry.search_endpoint
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
      []
    end
  end
end
