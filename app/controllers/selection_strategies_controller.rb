class SelectionStrategiesController < ApplicationController
  before_action :set_selection_strategy, only: [:show, :edit, :update, :destroy]

  respond_to :html

  def index
    @selection_strategies = SelectionStrategy.all
    respond_with(@selection_strategies)
  end

  def show
    respond_with(@selection_strategy)
  end

  def new
    @selection_strategy = SelectionStrategy.new
    respond_with(@selection_strategy)
  end

  def edit
  end

  def create
    @selection_strategy = SelectionStrategy.new(selection_strategy_params)
    @selection_strategy.save
    respond_with(@selection_strategy)
  end

  def update
    @selection_strategy.update(selection_strategy_params)
    respond_with(@selection_strategy)
  end

  def destroy
    @selection_strategy.destroy
    respond_with(@selection_strategy)
  end

  private
    def set_selection_strategy
      @selection_strategy = SelectionStrategy.find(params[:id])
    end

    def selection_strategy_params
      params.require(:selection_strategy).permit(:name)
    end
end
