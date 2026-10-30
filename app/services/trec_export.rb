# frozen_string_literal: true

# TREC qrels text: "<query id> 0 <doc id> <rating>", one line per rated doc.
module TrecExport
  def self.line query_id, doc_id, rating
    "#{query_id} 0 #{doc_id} #{rating}\n"
  end

  def self.generate_for_case kase
    kase.queries.sort_by(&:id).flat_map do |query|
      query.ratings.fully_rated.map { |rating| line(query.id, rating.doc_id, rating.rating) }
    end.join
  end

  def self.generate_for_snapshot snapshot
    snapshot_queries = snapshot.snapshot_queries.includes(:snapshot_docs).sort_by(&:id)
    # ratings has no unique (query_id, doc_id) index; keep the first row, as find_by did.
    ratings = {}
    Rating.where(query_id: snapshot_queries.map(&:query_id)).order(:id).each do |rating|
      ratings[[ rating.query_id, rating.doc_id ]] ||= rating
    end

    snapshot_queries.flat_map do |snapshot_query|
      snapshot_query.snapshot_docs.filter_map do |snapshot_doc|
        rating = ratings[[ snapshot_query.query_id, snapshot_doc.doc_id ]]&.rating
        line(snapshot_query.query_id, snapshot_doc.doc_id, rating) unless rating.nil?
      end
    end.join
  end
end
