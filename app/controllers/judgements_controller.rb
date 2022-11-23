class JudgementsController < ApplicationController
  before_action :set_judgement, only: [:show, :edit, :update, :destroy]

  respond_to :html

  def index
    @judgements = Judgement.all
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
    @judgement.save
    respond_with(@judgement)
  end

  def update
    @judgement.update(judgement_params)
    respond_with(@judgement)
  end

  def destroy
    @judgement.destroy
    respond_with(@judgement)
  end

  private
    def set_judgement
      @judgement = Judgement.find(params[:id])
    end

    def judgement_params
      params.require(:judgement).permit(:user_id, :rating, :query_doc_pair_id)
    end
end
