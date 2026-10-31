# frozen_string_literal: true

# Makes a case from the Home Depot Product Search Relevance competition data the user uploaded (HomeDepotData): its search
# terms as queries, each with the products raters judged for it. The competition's scores are the average of at least
# three raters on 1 (irrelevant) to 3 (perfect match), like 2.33; Quepid's ratings are whole numbers, so they are rounded
# to the nearest of the three, as 0 Irrelevant, 1 Partially relevant and 2 Perfect match (2.5 and 1.5 round up).
#
# Quepid does not keep the competition's files, only what the case needs: once it is made the uploaded files are
# deleted. So the products are kept in a judgement book that goes with the case, one query-document pair for each rated
# product with its title, description and brand, which is where the documents are indexed from (as Haystack's are).
class HomeDepotDataset
  BATCH_SIZE = 5000
  BRAND = 'MFG Brand Name'

  def initialize user
    @user = user
  end

  # Fills an existing case with the search terms, or a random sample of that many of them (in the file's order), and
  # their ratings, and gives it a book with the rated products. The name and scorer are the case's own already.
  def populate kase, sample: nil, **_options
    judged = judged_pairs
    terms = chosen_terms(judged.keys, sample)
    fields = product_fields(terms.flat_map { |term| judged[term].keys }.uniq)

    ActiveRecord::Base.transaction do
      made = terms.map { |term| kase.queries.create!(query_text: term) }
      Arrangement::List.normalize_in_order(made).each(&:save!)
      insert_ratings(terms.zip(made.map(&:id)).to_h, judged)
      kase.update!(book: make_book(kase, terms, judged, fields))
    end
    HomeDepotData.discard!
    kase
  end

  private

  # { search term => { product id => the average score of its rows } }, terms in the order the file first has them. A pair
  # is in the file once as a rule; if it is there more than once, its scores are averaged.
  def judged_pairs
    @titles = {}
    scores = Hash.new { |hash, term| hash[term] = Hash.new { |inner, product| inner[product] = [] } }
    HomeDepotData.each_row(:train) do |row|
      term = row['search_term'].to_s.strip
      score = Float(row['relevance'].to_s, exception: false)
      next if term.empty? || score.nil? || row['product_uid'].blank?

      product = row['product_uid'].strip
      scores[term][product] << score
      @titles[product] ||= row['product_title'].to_s.strip
    end
    scores.transform_values { |products| products.transform_values { |values| values.sum / values.size } }
  end

  def chosen_terms terms, sample
    sample ? terms.each_index.to_a.sample(sample).sort.map { |index| terms[index] } : terms
  end

  # 1 to 3, averaged over raters, to 0, 1 or 2.
  def rating score
    (score - 1).round.clamp(0, 2)
  end

  def insert_ratings query_ids, judged
    now = Time.current
    rows = query_ids.flat_map do |term, query_id|
      judged[term].map { |product, score| { query_id: query_id, doc_id: product, rating: rating(score), created_at: now, updated_at: now } }
    end
    rows.each_slice(BATCH_SIZE) { |batch| Rating.insert_all(batch) }
  end

  # { product id => its title, description and brand }, for the products the case rates only: the attribute file has
  # millions of rows, and only the brand is taken from it.
  def product_fields products
    fields = products.index_with { |product| { 'product_title' => @titles[product] } }
    HomeDepotData.each_row(:descriptions) do |row|
      fields[row['product_uid']]['product_description'] = row['product_description'] if fields.key?(row['product_uid'])
    end
    HomeDepotData.each_row(:attributes) do |row|
      fields[row['product_uid']]['brand'] ||= row['value'] if BRAND == row['name'] && fields.key?(row['product_uid'])
    end
    fields
  end

  # The book carries the rated products, so their documents can be indexed once the uploaded files are gone.
  def make_book kase, terms, judged, fields
    book = Book.create!(name: kase.case_name, owner: kase.owner)
    now = Time.current
    rows = terms.flat_map do |term|
      judged[term].keys.map do |product|
        { book_id: book.id, query_text: term, doc_id: product, document_fields: fields[product].compact.to_json, created_at: now, updated_at: now }
      end
    end
    rows.each_slice(BATCH_SIZE) { |batch| QueryDocPair.insert_all(batch) }
    book
  end
end
