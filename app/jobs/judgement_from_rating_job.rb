# frozen_string_literal: true

class JudgementFromRatingJob < ApplicationJob
  queue_as :default

  # Finds in-flight (not finished) SolidQueue rows for this job class whose
  # rating belongs to the given case. Unlike PopulateBookJob, this job's
  # only argument is a rating - there's no case or book GlobalID serialized
  # directly, so each candidate job's rating has to be resolved to find its
  # case. The Linked Cases card uses this to pulse a case's "sends pairs"
  # arrow while a rating made in the case view is actively flowing into the
  # book as a judgement.
  def self.active_for _book, kase
    SolidQueue::Job
      .where(class_name: name, finished_at: nil)
      .select { |job| job_targets_case?(job, kase) }
  end

  def self.actively_populating? book, kase
    active_for(book, kase).any?
  end

  def self.job_targets_case? job, kase
    args = job.arguments['arguments'] || []
    rating_arg = args.find { |a| a.is_a?(Hash) && a['_aj_globalid']&.include?('/Rating/') }
    return false unless rating_arg

    GlobalID::Locator.locate(rating_arg['_aj_globalid'])&.query&.case_id == kase.id
  end
  private_class_method :job_targets_case?

  def perform user, rating
    query = rating.query
    book = query.case.book
    if book
      query_doc_pair = book.query_doc_pairs.find_or_create_by query_text: rating.query.query_text, doc_id: rating.doc_id

      # We can't populate the query_doc_pair.document_fields since we don't have that data
      # but there are other fields we CAN update.
      # query_doc_pair.document_fields = pair[:document_fields].to_json

      # We need to think about the difference between a query / rating and a query_doc_pair.
      # query_doc_pair.information_need = query.information_need
      # query_doc_pair.notes = query.notes
      # query_doc_pair.options = query.options

      query_doc_pair.save!

      judgement = query_doc_pair.judgements.find_or_initialize_by(user: user)
      judgement.rating = rating.rating
      judgement.save!

      BroadcastLinkedCasesJob.perform_later(book)
    end
  end
end
