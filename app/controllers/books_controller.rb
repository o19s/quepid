# frozen_string_literal: true

class BooksController < ApplicationController
  before_action :find_book, only: [ :show, :edit, :update, :destroy, :combine ]
  before_action :check_book, only: [ :show, :edit, :update, :destroy, :combine ]

  respond_to :html

  def index
    @books = current_user.books_involved_with.includes([ :team, :scorer, :selection_strategy ])
    respond_with(@books)
  end

  def show
    @cases = Case.where(book_id: @book.id)
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
    puts "I got params: #{book_ids}"

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

    puts "Target book #{@book.name}: #{@book.query_doc_pairs.count} qdps, #{@book.judgements.count} j"
    books.each do |book_to_merge|
      puts "Source book #{book_to_merge.name}: #{book_to_merge.query_doc_pairs.count} qdps, #{book_to_merge.judgements.count} j"

      book_to_merge.query_doc_pairs.each do |qdp|
        query_doc_pair = @book.query_doc_pairs.find_or_create_by query_text: qdp.query_text,
                                                                 doc_id:     qdp.doc_id

        puts "Looking at mergining into target Query Doc Pair #{query_doc_pair.id}"
        puts "For source qdp #{qdp.query_text}/#{qdp.doc_id} I have #{qdp.judgements.rateable.size}"
        qdp.judgements.rateable.each do |j|
          puts 'I am a judgement, I am here.'
          puts "Source rating is #{j.rating} and user is #{j.user.name}"
          judgement = query_doc_pair.judgements.find_or_initialize_by(user: j.user)
          puts "Does target judgment already have a rating?  #{judgement.rating}"
          puts "Does target judgment have a primary key?  #{judgement.id}"
          puts "Does target judgment have errors?  #{judgement.errors.count}"
          puts "Does target judgment have errors message?  #{judgement.errors.full_messages.to_sentence}"
          judgement.rating = if judgement.rating
                               ((judgement.rating + j.rating) / 2).round
                             else
                               j.rating
                             end
          puts "Target query_doc_pair judgemetns size #{query_doc_pair.judgements.size}"
          # unless judgement.save
          # puts 'Boom!!!!!!!!!'
          #  flash.alert = 'Could save query doc pair'
          # end
        end
        query_doc_pair_count += 1
        # unless query_doc_pair.save
        #  puts 'Boom!!!!!!!!!'
        #  flash.alert = 'Could save query doc pair'
        # end
      end
    end

    puts 'Lets see about changes to save...'
    puts "@book.has_changes_to_save? #{@book.has_changes_to_save?}"
    @book.query_doc_pairs.each do |qdp|
      puts "qdp #{qdp.id} has changes to save? #{qdp.has_changes_to_save?}"
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
