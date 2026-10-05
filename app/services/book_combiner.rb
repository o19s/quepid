# frozen_string_literal: true

class BookCombiner
  class ScaleMismatch < StandardError; end

  attr_reader :query_doc_pair_count

  def initialize book, source_books
    @book = book
    @source_books = source_books
    @query_doc_pair_count = 0
  end

  def combine
    raise ScaleMismatch if @source_books.any? { |source| source.scale != @book.scale }

    Book.transaction do
      @source_books.each do |source|
        source.query_doc_pairs.each { |pair| merge_pair(pair) }
      end
      @book.save!
    end

    query_doc_pair_count
  end

  private

  def merge_pair source
    pair = @book.find_or_create_query_doc_pair(query_text: source.query_text, doc_id: source.doc_id)
    pair.document_fields = source.document_fields
    pair.position = source.position if pair.position.nil? && !source.position.nil?

    source.judgements.includes([ :user ]).rateable.each do |judgement|
      merge_judgement(pair, judgement)
    end
    @query_doc_pair_count += 1
    pair.save!
  end

  def merge_judgement pair, source
    judgement = pair.judgements.find_or_initialize_by(user: source.user)
    judgement.rating = judgement.rating ? (judgement.rating + source.rating) / 2 : source.rating
    judgement.rating = judgement.rating.round unless @book.support_implicit_judgements
    judgement.save!
  end
end
