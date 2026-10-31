# frozen_string_literal: true

require 'zip'

# The Haystack "Rating Party" example dataset: a case of 137 e-commerce queries and the
# judgement book that goes with it, shipped as zipped exports in db/sample_data.
#
# Used by the Datasets page and by `thor sample_data:haystack_party`.
class HaystackDataset
  CASE_FILE = 'haystack_rating_party_case.json.zip'
  BOOK_FILE = 'haystack_rating_party_book.json.zip'

  class Error < StandardError; end

  # By default the people who rated in the original rating party are dropped, so loading the
  # dataset doesn't invite their addresses as users; ratings and judgements are kept, unattributed.
  # The Thor task keeps them and creates the users.
  def initialize user, keep_raters: false
    @user = user
    @keep_raters = keep_raters
  end

  # Fills an existing case with the dataset's queries and ratings, and gives it the dataset's book. The
  # export would overwrite the case's name and scorer, so those are put back (the ratings are 0-3, so
  # whatever scorer the user picked works).
  #
  # The case keeps the search endpoint and query settings of the export, on purpose: it is a Chorus Solr where the
  # Haystack documents are already indexed, so the case works at once. Change backend on the Dataset Cases tab moves
  # it to another engine.
  #
  # With a sample (a number of queries), only that many randomly chosen queries are loaded, with their
  # ratings and the book's pairs for them.
  def populate kase, case_name: nil, scorer: nil, sample: nil
    @sample = sample
    import_case(kase)
    # Straight away, not after the book: that import is the slow part, and the case shows the export's name until then.
    kase.update!({ case_name: case_name.presence, scorer: scorer }.compact)
    kase.update!(book: import_book(Book.new))
    kase
  end

  def import_case kase = Case.new
    importer = CaseImporter.new(kase, @user, read(CASE_FILE), force_create_users: @keep_raters)
    importer.validate
    raise Error, kase.errors.full_messages.to_sentence if kase.errors.any?
    raise Error, 'Could not import the Haystack case.' unless importer.import

    kase
  end

  def import_book book = Book.new
    importer = BookImporter.new(book, @user, read(BOOK_FILE), force_create_users: @keep_raters)
    importer.validate
    raise Error, book.errors.full_messages.to_sentence if book.errors.any?
    raise Error, 'Could not import the Haystack book.' unless importer.import

    book
  end

  private

  def read file
    data = parse(file)
    data = without_raters(data) unless @keep_raters
    @sample ? sampled(data) : data
  end

  def parse file
    JSON.parse(unzip(Rails.root.join('db/sample_data', file))).deep_symbolize_keys
  end

  # Keeps the sampled queries, in the order the export has them, and the book's pairs for them.
  def sampled data
    data[:queries] = data[:queries].select { |query| sampled_texts.include?(query[:query_text]) } if data[:queries]
    data[:query_doc_pairs] = data[:query_doc_pairs].select { |pair| sampled_texts.include?(pair[:query_text]) } if data[:query_doc_pairs]
    data
  end

  # Chosen once, from the case's queries, so the case and the book are sampled alike.
  def sampled_texts
    @sampled_texts ||= parse(CASE_FILE)[:queries].pluck(:query_text).sample(@sample).to_set
  end

  def unzip file
    Zip::File.open(file) do |zip|
      # Zips made on a Mac also carry a __MACOSX/ resource-fork entry.
      zip.find { |entry| entry.file? && !entry.name.start_with?('__MACOSX') }.get_input_stream.read.force_encoding('UTF-8')
    end
  end

  def without_raters data
    data[:queries]&.each { |query| query[:ratings]&.each { |rating| rating.delete(:user_email) } }
    data[:query_doc_pairs]&.each { |pair| pair[:judgements]&.each { |judgement| judgement.delete(:user_email) } }
    data
  end
end
