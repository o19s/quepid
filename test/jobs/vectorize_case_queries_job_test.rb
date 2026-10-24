# frozen_string_literal: true

require 'test_helper'

class VectorizeCaseQueriesJobTest < ActiveJob::TestCase
  URL = 'https://api.openai.com/v1/embeddings'

  let(:embedder) { embedders(:openai_small) }
  let(:acase)    { cases(:shared_with_team) }

  def respond_with_vectors
    stub_request(:post, URL).to_return do |request|
      inputs = JSON.parse(request.body)['input']
      { status: 200, headers: { 'Content-Type' => 'application/json' },
        body: { data: inputs.each_index.map { |i| { index: i, embedding: Array.new(512, 0.1) } } }.to_json }
    end
  end

  setup do
    acase.queries.destroy_all
    acase.update!(embedder: embedder)
  end

  test 'vectorises only the queries that need it' do
    pending_query = acase.queries.create!(query_text: 'pending')
    current_query = acase.queries.create!(query_text: 'current')
    respond_with_vectors
    QueryVectorizer.new(embedder).vectorize([ current_query ])
    WebMock::RequestRegistry.instance.reset!

    VectorizeCaseQueriesJob.perform_now(acase)

    assert_requested(:post, URL, times: 1) { |request| [ 'pending' ] == JSON.parse(request.body)['input'] }
    assert_equal 'current', pending_query.reload.vector_status(embedder).status
  end

  test 'force redoes every query' do
    acase.queries.create!(query_text: 'one')
    stub = respond_with_vectors
    VectorizeCaseQueriesJob.perform_now(acase)
    WebMock::RequestRegistry.instance.reset!

    VectorizeCaseQueriesJob.perform_now(acase, force: true)

    assert_requested stub, times: 1
  end

  test 'does nothing without an embedder' do
    acase.update!(embedder: nil)
    acase.queries.create!(query_text: 'one')

    VectorizeCaseQueriesJob.perform_now(acase)

    assert_not_requested :post, URL
  end

  test 'enqueue_for only enqueues for a case with an embedder' do
    assert_enqueued_with(job: VectorizeCaseQueriesJob, args: [ acase, { force: false } ]) do
      VectorizeCaseQueriesJob.enqueue_for(acase)
    end

    acase.update!(embedder: nil)
    assert_no_enqueued_jobs(only: VectorizeCaseQueriesJob) { VectorizeCaseQueriesJob.enqueue_for(acase) }
  end

  test 'statuses for the whole case come from the metadata alone' do
    current = acase.queries.create!(query_text: 'current')
    pending_query = acase.queries.create!(query_text: 'pending')
    respond_with_vectors
    QueryVectorizer.new(embedder).vectorize([ current ])

    statuses = Query.vector_statuses_for(acase)

    assert_equal 'current', statuses[current.id].status
    assert_equal 'pending', statuses[pending_query.id].status
  end

  test 'editing an embedder setting that changes the vectors re-vectorises its cases; renaming does not' do
    assert_no_enqueued_jobs(only: VectorizeCaseQueriesJob) { embedder.update!(name: 'Renamed') }

    assert_enqueued_with(job: VectorizeCaseQueriesJob, args: [ acase, { force: false } ]) do
      embedder.update!(model: 'text-embedding-3-large')
    end
  end
end
