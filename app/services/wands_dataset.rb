# frozen_string_literal: true

# Makes a case from Wayfair's WANDS dataset: its queries, each with the products human raters judged for it. The ratings
# are WANDS' own three labels on a scale of their own, so the case's scorer has to be one with the same labels (Create
# scorer makes one). The documents are not stored in the case: they are indexed from the WANDS files (DatasetDocuments).
class WandsDataset
  # Irrelevant, Partial and Exact as 0, 1 and 2.
  RATINGS = { 'Irrelevant' => 0, 'Partial' => 1, 'Exact' => 2 }.freeze
  BATCH_SIZE = 5000

  def initialize user
    @user = user
  end

  # Fills an existing case with the queries, or with a random sample of that many of them (in WANDS' order), and their
  # ratings. The name and scorer are the case's own already.
  def populate kase, sample: nil, **_options
    WandsData.fetch!(:query, :label)
    queries = chosen_queries(sample)
    made = queries.map { |_, text| kase.queries.create!(query_text: text) }
    Arrangement::List.normalize_in_order(made).each(&:save!)
    insert_ratings(queries.map(&:first).zip(made.map(&:id)).to_h)
    kase
  end

  private

  def chosen_queries sample
    all = []
    WandsData.each_row(:query) { |row| all << [ row['query_id'], row['query'].to_s.strip ] }
    all.reject! { |_, text| text.empty? }
    sample ? all.each_index.to_a.sample(sample).sort.map { |index| all[index] } : all
  end

  # One rating per query and product. WANDS labels some pairs more than once (1,467 of 231,873), and for 14 the labels
  # disagree: the most common one is kept, and the higher of two that tie.
  def insert_ratings quepid_query_ids
    labels = Hash.new { |hash, key| hash[key] = [] }
    WandsData.each_row(:label) do |row|
      rating = RATINGS[row['label']]
      query_id = quepid_query_ids[row['query_id']]
      labels[[ query_id, row['product_id'] ]] << rating if rating && query_id
    end

    now = Time.current
    labels.map { |(query_id, doc_id), ratings| { query_id: query_id, doc_id: doc_id, rating: settle(ratings), created_at: now, updated_at: now } }
      .each_slice(BATCH_SIZE) { |batch| Rating.insert_all(batch) }
  end

  def settle ratings
    ratings.tally.max_by { |rating, count| [ count, rating ] }.first
  end
end
