# frozen_string_literal: true

# Vectorises the queries of one case with the case's embedder: the ones
# QueryVectorStatus says need it (pending, stale or failed), or all of them with
# `force`. Progress isn't pushed anywhere -- the core case page has no ActionCable --
# instead the page polls Api::V1::CaseEmbeddersController#index, which reads each
# query's status and asks running? whether a run is still under way.
class VectorizeCaseQueriesJob < ApplicationJob
  queue_as :bulk_processing

  # One run per case at a time. A trigger arriving mid-run waits rather than being
  # dropped: the waiting run then finds whatever the first one didn't cover (a newly
  # added query, an embedder changed mid-run) and is a cheap no-op otherwise.
  limits_concurrency to:       1,
                     key:      ->(kase, **) { "vectorize_case_#{kase.id}" },
                     duration: 30.minutes

  # Enqueues a run if the case has an embedder; the one call every trigger uses.
  def self.enqueue_for kase, force: false
    return if kase.nil? || kase.embedder_id.nil?

    perform_later(kase, force: force)
  end

  # Is a run for this case queued or in progress? Mirrors PopulateBookJob.active_for.
  def self.running? kase
    return false unless solid_queue?

    gid = kase.to_global_id.to_s
    SolidQueue::Job
      .where(class_name: name, finished_at: nil)
      .where('arguments LIKE ?', "%#{gid}%")
      .any? { |job| (job.arguments['arguments'] || []).any? { |a| a.is_a?(Hash) && a['_aj_globalid'] == gid } }
  end

  def self.solid_queue?
    :solid_queue == Rails.application.config.active_job.queue_adapter && defined?(SolidQueue::Job)
  end
  private_class_method :solid_queue?

  def perform kase, force: false
    embedder = kase.embedder
    return if embedder.nil?

    queries = kase.queries.to_a
    queries = queries.select { |query| query.vector_status(embedder).needs_work? } unless force
    return if queries.empty?

    result = QueryVectorizer.new(embedder).vectorize(queries)
    return if result.errors.empty?

    Rails.logger.warn("VectorizeCaseQueriesJob case #{kase.id}: #{result.failed} queries failed: #{result.errors.uniq.join('; ')}")
  end
end
