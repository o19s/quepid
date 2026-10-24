# frozen_string_literal: true

class QueryTools < QuepidToolset
  tool :create_query,
       writes:      true,
       description: 'Add a query to a case; returns the existing query when the text is already there' do
    param :case_id, :integer, required: true
    param :query_text, :string, required: true
    param :information_need, :string
    param :notes, :string
    param :options, :object, desc: 'per-query options, e.g. values for #$qOption.<name>## in the try'
  end

  def create_query case_id:, query_text:, information_need: nil, notes: nil, options: nil
    kase = find_case(case_id)
    text = query_text.strip
    existing = kase.queries.find_by(query_text: text)
    return query_json(existing) if existing

    query = kase.queries.build(query_text: text, information_need: information_need, notes: notes,
                               options: options)
    save! query
    kase.save
    track { Analytics::Tracker.track_query_created_event current_user, query }
    query_json query
  end

  tool :update_query, writes: true, description: "Change a query's information need, notes or options" do
    param :query_id, :integer, required: true
    param :information_need, :string
    param :notes, :string
    param :options, :object
  end

  def update_query query_id:, information_need: nil, notes: nil, options: nil
    query = find_query(query_id)
    query.information_need = information_need unless information_need.nil?
    query.notes = notes unless notes.nil?
    query.options = options unless options.nil?
    save! query
    query_json query
  end

  tool :delete_query, writes: true, description: 'Delete a query and its ratings from its case' do
    param :query_id, :integer, required: true
  end

  def delete_query query_id:
    query = find_query(query_id)
    kase = query.case
    query.remove_from_list
    query.destroy
    track { Analytics::Tracker.track_query_deleted_event current_user, query }
    kase.rearrange_queries
    kase.save
    { query_id: query_id, deleted: true }
  end

  tool :rate_document, writes: true, description: 'Set the rating of one document for a query (case side)' do
    param :query_id, :integer, required: true
    param :doc_id, :string, required: true, desc: "the search engine's document id"
    param :rating, :number, required: true, desc: "a value on the case scorer's scale"
  end

  def rate_document query_id:, doc_id:, rating:
    query = find_query(query_id)
    record = query.ratings.find_or_create_by(doc_id: doc_id)
    record.user = current_user
    record.rating = rating
    save! record
    track { Analytics::Tracker.track_rating_created_event current_user, record }
    JudgementFromRatingJob.perform_later current_user, record
    record.as_json(only: [ :id, :query_id, :doc_id, :rating, :user_id, :updated_at ])
  end

  tool :delete_rating, writes: true, description: 'Remove the rating of one document for a query' do
    param :query_id, :integer, required: true
    param :doc_id, :string, required: true
  end

  def delete_rating query_id:, doc_id:
    query = find_query(query_id)
    record = query.ratings.find_by(doc_id: doc_id) or raise "No rating for #{doc_id} on query #{query_id}"
    record.delete
    track { Analytics::Tracker.track_rating_deleted_event current_user, record }
    { query_id: query.id, doc_id: doc_id, deleted: true }
  end

  private

  def query_json query
    query.as_json(only: [ :id, :case_id, :query_text, :information_need, :notes, :options,
                          :created_at, :updated_at ])
  end
end
