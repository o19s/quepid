# frozen_string_literal: true

# rubocop:disable Metrics/ClassLength
class BooksController < ApplicationController
  before_action :find_book, only: [ :show, :edit, :update, :destroy, :combine, :assign_anonymous ]
  before_action :check_book, only: [ :show, :edit, :update, :destroy, :combine, :assign_anonymous ]

  respond_to :html

  def index
    @books = current_user.books_involved_with.includes([ :team, :scorer, :selection_strategy ])
    respond_with(@books)
  end

  def show
    @count_of_anonymous_book_judgements = @book.judgements.where(user: nil).count
    @count_of_anonymous_case_judgements = 0
    @book.cases.each do |kase|
      @count_of_anonymous_case_judgements += kase.ratings.where(user: nil).count
    end
    @cases = @book.cases
    @leaderboard_data = []
    unique_judges = @book.judgements.rateable.preload(:user).collect(&:user).uniq
    unique_judges.each do |judge|
      @leaderboard_data << { judge:      judge.nil? ? 'anonymous' : judge.name,
                             judgements: @book.judgements.where(user: judge).count }
    end

    respond_with(@book)
  end

  def new
    # we actually support passing in starting point configuration for a book
    @book = if params[:book]
              Book.new(book_params)
            else
              Book.new
            end
    respond_with(@book)
  end

  def edit
  end

  def create
    @book = Book.new(book_params)
    @book.save
    respond_with(@book)
  end

  def update
    @book.update(book_params)
    respond_with(@book)
  end

  def destroy
    @book.destroy
    respond_with(@book)
  end

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/PerceivedComplexity
  # rubocop:disable Layout/LineLength
  def combine
    book_ids = params[:book_ids].select { |_key, value| '1' == value }.keys.map(&:to_i)

    query_doc_pair_count = 0

    books = []
    book_ids.each do |book_id|
      book_to_merge = current_user.books_involved_with.where(id: book_id).first
      books << book_to_merge
    end

    if books.any? { |b| b.scorer.scale != @book.scorer.scale }
      redirect_to books_path,
                  :alert => "One of the books chosen doesn't have a scorer with the scale #{@book.scorer.scale}" and return
    end

    books.each do |book_to_merge|
      book_to_merge.query_doc_pairs.each do |qdp|
        query_doc_pair = @book.query_doc_pairs.find_or_create_by query_text: qdp.query_text,
                                                                 doc_id:     qdp.doc_id

        # copy over the document fields if our source is newer than our target.
        # if qdp.updated_at > query_doc_pair.updated_at or query_doc_pair.document_fields.blank?
        query_doc_pair.document_fields = qdp.document_fields
        # end

        # copy over the position if our source has a position and our target doesn't.
        query_doc_pair.position = qdp.position if query_doc_pair.position.nil? && !qdp.position.nil?

        qdp.judgements.includes([ :user ]).rateable.each do |j|
          judgement = query_doc_pair.judgements.find_or_initialize_by(user: j.user)

          judgement.rating = if judgement.rating
                               (judgement.rating + j.rating) / 2
                             else
                               j.rating
                             end

          judgement.rating = judgement.rating.round unless @book.support_implicit_judgements

          judgement.save
        end
        query_doc_pair_count += 1

        # This .save seems required though I don't know why.'
        query_doc_pair.save
      end
    end

    if @book.save
      redirect_to books_path, :notice => "Combined #{query_doc_pair_count} query/doc pairs."
    else
      redirect_to books_path,
                  :alert => "Could not merge due to errors: #{@book.errors.full_messages.to_sentence}. #{query_doc_pair_count} query/doc pairs."
    end
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/PerceivedComplexity
  # rubocop:enable Layout/LineLength

  def assign_anonymous
    assignee = @book.team.members.where(id: params[:assignee_id]).take
    @book.judgements.where(user: nil).each do |judgement|
      judgement.user = assignee
      judgement.save!
    end
    @book.cases.each do |kase|
      kase.ratings.where(user: nil).each do |rating|
        rating.user = assignee
        rating.save!
      end
    end

    # if @book.save
    redirect_to books_path, :notice => "Assigned #{assignee.fullname} to ratings and judgements."
    # else
    ##           :alert => "Could not merge due to errors: #{@book.errors.full_messages.to_sentence}."
    # end
  end

  private

  def find_book
    @book = current_user.books_involved_with.where(id: params[:id]).first
  end

  def check_book
    render json: { message: 'Book not found!' }, status: :not_found unless @book
  end

  def book_params
    params.require(:book).permit(:team_id, :scorer_id, :selection_strategy_id, :name, :support_implicit_judgements)
  end
end

# rubocop:enable Metrics/ClassLength
