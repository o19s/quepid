# frozen_string_literal: true

# Indexes the documents of a case made from a dataset into the index that was just created on a search endpoint (see
# DatasetCaseIndexesController). The progress is on the case's link to the dataset, for the Dataset Cases tab.
class IndexDatasetDocumentsJob < ApplicationJob
  queue_as :bulk_processing

  def perform link, endpoint, index_name
    link.update!(indexing_status: 'indexing', documents_indexed: 0, indexing_error: nil)
    entry = DatasetCatalog.find(link.dataset.key)
    documents = DatasetDocuments.canonical(entry, link.case)
    result = DatasetIndex::Indexer.new(endpoint, index_name).index(documents) { |count| link.update_columns(documents_indexed: count) }
    finish(link, result)
  rescue DatasetIndex::Error, WandsData::Error => e
    # The endpoint said no, or could not be reached: say so on the link, there is nothing to retry blindly.
    fail_link(link, e.message)
  rescue StandardError => e
    fail_link(link, e.message)
    raise
  end

  private

  def finish link, result
    link.update!(documents_indexed: result.indexed)
    if result.failed.zero?
      link.update!(indexing_status: 'done')
    else
      fail_link(link, "#{result.failed} of #{result.indexed + result.failed} documents were refused, the first because: #{result.first_error}")
    end
  end

  def fail_link link, message
    link.update!(indexing_status: 'failed', indexing_error: message.to_s.truncate(1000))
  end
end
