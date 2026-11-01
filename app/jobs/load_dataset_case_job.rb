# frozen_string_literal: true

# Fills in a case made from an example dataset (a CaseToDataset link): loads its queries, and for
# datasets that have one its judgement book. Creating the case is quick; this is the slow part.
class LoadDatasetCaseJob < ApplicationJob
  queue_as :bulk_processing

  # case_name and scorer are what the user picked: the datasets' own exports would overwrite them. A sample
  # is a number of queries to load instead of all of them.
  def perform link, case_name, scorer, sample = nil
    link.update!(status: 'loading', error: nil)
    clear_earlier_attempt(link.case)
    entry = DatasetCatalog.find(link.dataset.key)
    entry.loader.new(link.case.owner).populate(link.case, case_name: case_name, scorer: scorer, sample: sample)
    link.update!(status: 'done')
  rescue HaystackDataset::Error, WandsData::Error, HomeDepotData::Error, ActiveRecord::RecordInvalid => e
    # A problem with the data itself: say so on the link, there is nothing to retry.
    fail_link(link, e)
  rescue StandardError => e
    fail_link(link, e)
    raise
  end

  private

  # The case is made empty for this job, so queries in it are what an earlier run of this job left before it failed or
  # its worker died (Solid Queue runs it again, and so does Retry in Mission Control). They go, so a retry loads the
  # dataset once rather than on top of half of it.
  def clear_earlier_attempt kase
    queries = Query.unscoped.where(case_id: kase.id)
    return unless queries.exists?

    Rating.where(query_id: queries.select(:id)).delete_all
    queries.delete_all
  end

  def fail_link link, error
    link.update!(status: 'failed', error: error.message.truncate(1000))
  end
end
