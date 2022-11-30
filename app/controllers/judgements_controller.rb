class JudgementsController < ApplicationController
  before_action :set_judgement, only: [:show, :edit, :update, :destroy]

  respond_to :html

  def index
    @judgements = Judgement.all.includes([:query_doc_pair])
    respond_with(@judgements)
  end

  def show
    respond_with(@judgement)
  end

  def new
    @judgement = Judgement.new
    respond_with(@judgement)
  end

  def edit
  end

  def create
    @judgement = Judgement.new(judgement_params)

    # if @judgement != nil
    #   puts "id: " + @judgement.id.to_s
    #   puts "qdp_id: " + @judgement.query_doc_pair_id.to_s
    #   puts "user_id: " + @judgement.user_id.to_s
    #   puts "rating: " + @judgement.rating.to_s
    # else
    #   puts "judgement was nil"
    # end
    # puts @judgement.to_s

    begin
      @judgement.save!
    rescue => e
      puts e.backtrace
    end

    respond_with(@judgement, :location => book_judgements_path)

    #puts "create judgement_params .. "+ judgement_params.to_s

    #@query_doc_pair = QueryDocPair.find(@judgement.query_doc_pair_id)
    #respond_with(@judgement, :location => book_judgement_path)
    #@judgement.id = 1
    #@query_doc_pair_id = @judgement.query_doc_pair_id
    #puts "query_doc_pair_id: " + @query_doc_pair_id.to_s
    #@query_doc_pair = QueryDocPair.find(@query_doc_pair_id)
    #puts "query_doc_pair's book_id: " + @query_doc_pair.book_id.to_s
    #@book = Book.find(@query_doc_pair.book_id)
    #puts "book id is " + @book.id.to_s
    #puts @judgement.rating
    #puts @judgement.id
    #respond_with(@judgement, :location => book_judgements_path)
    #

    #respond_with(@judgement, :location => book_judgements_path)
    #, :location => book_judgements_path)
    # puts "create .. new called"
    # begin
    #
    #   puts "create .. save called"
    # rescue Error
    #   puts "error caught"
    # end
    #respond_with(@judgement, :location => book_judgement_path)
    #respond_with(@judgement, :location => book_judgement_url)
    #respond_with(@judgement, :location => book_judgements_url) # book must exist
    #respond_with(@judgement, :location => book_judgements_path) # book must exist
    # book_judgement_url
    # book_judgements_url
    # book_judgements_path
    # new_book_judgement_url
    #respond_with(@book, @judgement) #, :location => new_book_judgement_url) # book must exist
    # begin
    #   #respond_with(@book) #, :location => new_book_judgement_url) # book must exist
    #   puts "begin"
    #   respond_with(@judgement, :location => book_judgements_path)
    # rescue => e
    #   puts "rescue"
    #   puts e.backtrace
    #   #raise Stan
    #   #
    #   #
    #   # dardError, 'message'
    #   # puts "huh?"
    # end
    #
    # puts "after begin/rescue"
    # #respond_with(@judgement, :location => book_judgements_path)
    #puts judgement_params.to_s
    #puts "about to save"
    #puts "got here"
    # @query_doc_pair = QueryDocPair.find(@judgement.query_doc_pair_id)
    # @book =
    # puts "and the book id is " + @book.id.to_s
    # if @judgement.query_doc_pair_id != nil
    #   puts "got here 1"
    #   @query_doc_pair = QueryDocPair.find(@judgement.query_doc_pair_id)
    #   if @query_doc_pair != nil and @query_doc_pair.book_id != nil
    #     puts "got here 2"
    #     @book = Book.find(@query_doc_pair.book_id)
    #   end
    # end
    # @query_doc_pair = QueryDocPair.new(query_doc_pair_params)
    # @query_doc_pair.save
    # # respond_with(@query_doc_pair, :location => new_book_query_doc_pair_path(@query_doc_pair))
    # respond_with(@query_doc_pair, :location => book_query_doc_pairs_path)
  end

  def update
    @judgement.update(judgement_params)
    respond_with(@judgement, :location => book_judgement_path)
    # respond_with(@judgement)
  end

  def destroy
    # @judgement.destroy
    # respond_with(@judgement)

    #@query_doc_pair = QueryDocPair.find(@judgement.query_doc_pair_id)
    #@book_id = @query_doc_pair.book_id
    @judgement.destroy
    respond_with(@judgement, :location => book_judgements_path)
  end

  private
    def set_judgement
      @judgement = Judgement.find(params[:id])
      # if @judgement.query_doc_pair_id != nil
      #   @query_doc_pair = QueryDocPair.find(@judgement.query_doc_pair_id)
      #   if @query_doc_pair != nil and @query_doc_pair.book_id != nil
      #     @book = Book.find(@query_doc_pair.book_id)
      #   end
      # end
    end

    def judgement_params
      params.require(:judgement).permit(:user_id, :rating, :query_doc_pair_id)
    end
end
