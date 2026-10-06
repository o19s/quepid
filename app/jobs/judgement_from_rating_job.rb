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
      .where.missing(:failed_execution)
      .select { |job| job_targets_case?(job, kase) }
  end

  def self.actively_populating? book, kase
    active_for(book, kase).any?
  end

  def self.job_targets_case? job, kase
    args = job.arguments['arguments'] || []
    ids = args[1]
    if ids.is_a?(Array)
      Rating.joins(:query).exists?(id: ids, queries: { case_id: kase.id })
    else
      rating_arg = args.find { |arg| arg.is_a?(Hash) && arg['_aj_globalid']&.include?('/Rating/') }
      rating_arg && safely_locate(rating_arg['_aj_globalid'])&.query&.case_id == kase.id
    end
  end
  private_class_method :job_targets_case?

  def perform user, rating
    ids = rating.is_a?(Array) ? rating : [ rating.id ]
    JudgementSync.batch do
      Rating.where(id: ids).includes(query: :case).find_each do |item|
        book = item.query.case.book
        next unless book

        pair = book.find_or_initialize_query_doc_pair(query_text: item.query.query_text, doc_id: item.doc_id)
        pair.save!
        judgement = pair.judgements.find_or_initialize_by(user: user)
        judgement.rating = item.rating
        judgement.save!
        BroadcastLinkedCasesJob.perform_later(book)
      end
    end
  end
end
