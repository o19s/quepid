# frozen_string_literal: true

# Links a case to the Dataset it was loaded from. The case is created at once and its queries are
# loaded by LoadDatasetCaseJob; status says where that is, and error why it failed.
class CaseToDataset < ApplicationRecord
  STATUSES = %w[pending loading done failed].freeze

  belongs_to :dataset
  belongs_to :case

  validates :case_id, uniqueness: true
  validates :status, inclusion: { in: STATUSES }

  # Deletes the owner's links whose case has been deleted. Cases are deleted without telling us (the Case model
  # knows nothing about datasets), and the lists already skip such links, so this only tidies the table.
  def self.drop_orphans_of owner
    where(dataset_id: Dataset.where(owner: owner).select(:id)).where.not(case_id: Case.select(:id)).delete_all
  end

  # The empty case for a dataset, linked to it as pending, for a background job to fill in. A sample size says it is only
  # that many of the dataset's queries.
  def self.start! owner:, dataset_key:, case_name:, scorer:, sample_size: nil
    transaction do
      kase = Case.create!(case_name: case_name, owner: owner, scorer: scorer)
      create!(dataset: Dataset.for(owner, dataset_key), case: kase, sample_size: sample_size)
    end
  end

  # Distinct documents per case: those rated in it plus those in its judgement book's query-document pairs, as
  # { case_id => count }. One UNION in SQL, so a big case isn't loaded into Ruby to be counted.
  def self.document_counts case_ids
    return {} if case_ids.empty?

    sql = sanitize_sql_array([ <<~SQL.squish, case_ids, case_ids ])
      SELECT docs.case_id, COUNT(DISTINCT docs.doc_id)
      FROM (
        SELECT queries.case_id AS case_id, ratings.doc_id AS doc_id
          FROM ratings INNER JOIN queries ON queries.id = ratings.query_id
          WHERE queries.case_id IN (?)
        UNION
        SELECT cases.id AS case_id, query_doc_pairs.doc_id AS doc_id
          FROM cases INNER JOIN query_doc_pairs ON query_doc_pairs.book_id = cases.book_id
          WHERE cases.id IN (?)
      ) docs
      GROUP BY docs.case_id
    SQL
    connection.select_rows(sql).to_h { |case_id, count| [ case_id.to_i, count.to_i ] }
  end

  def in_progress?
    %w[pending loading].include?(status)
  end

  # Its documents are being indexed into a search engine (not waiting for its queries to load: that is in_progress?).
  def indexing?
    %w[pending indexing].include?(indexing_status)
  end

  def indexing_failed?
    'failed' == indexing_status
  end

  def failed?
    'failed' == status
  end

  # The documents are about to be indexed into index_name: by a background job (pending), or by the user's browser, which
  # reports back through record_progress.
  def start_indexing! index_name, in_browser: false
    update!(index_name: index_name, indexing_status: in_browser ? 'indexing' : 'pending', documents_indexed: 0, indexing_error: nil)
  end

  # How far the browser has got: status is indexing, done or failed (anything else is taken as indexing).
  def record_progress! status:, documents_indexed:, error: nil
    status = 'indexing' unless %w[indexing done failed].include?(status)
    update!(indexing_status: status, documents_indexed: documents_indexed.to_i, indexing_error: ('failed' == status ? error.to_s.truncate(1000) : nil))
  end
end
