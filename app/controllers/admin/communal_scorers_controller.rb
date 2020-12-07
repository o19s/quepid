# frozen_string_literal: true

module Admin
  class CommunalScorersController < Admin::AdminController
    before_action :set_scorer, only: [ :show, :edit, :update ]

    def index
      @scorers = Scorer.communal
    end

    def show; end

    def new
      @scorer = Scorer.new
      @scorer.communal = true
    end

    def create
      @scorer = Scorer.new scorer_params
      @scorer.communal = true

      if @scorer.save
        redirect_to admin_communal_scorer_path(@scorer)
      else
        render action: :new
      end
    rescue ActiveRecord::SerializationTypeMismatch
      # Get a version of the params without the scale, which is causing
      # the Exception to be raised.
      sanitized_params = scorer_params
      sanitized_params.delete(:scale)
      sanitized_params.delete('scale')

      # Reinitialize the object without the scale, to maintain the
      # passed values, just in case another error should be communicated
      # back to the caller.
      @scorer = Scorer.new sanitized_params
      @scorer.errors.add(:scale, :type)

      render action: :new
    end

    def edit; end

    def update
      if @scorer.update scorer_params
        redirect_to admin_communal_scorer_path(@scorer)
      else
        render action: :edit
      end
    rescue ActiveRecord::SerializationTypeMismatch
      @scorer.reload

      # Get a version of the params without the scale, which is causing
      # the Exception to be raised.
      sanitized_params = scorer_params
      sanitized_params.delete(:scale)
      sanitized_params.delete('scale')

      # Re-update the object without the scale, to maintain the
      # passed values, just in case another error should be communicated
      # back to the caller.
      @scorer.update sanitized_params
      @scorer.errors.add(:scale, :type)

      render action: :edit
    end

    private

    def scorer_params
      return unless params[:scorer]

      params.require(:scorer).permit(
        :code,
        :name,
        :communal,
        :manual_max_score,
        :manual_max_score_value,
        :show_scale_labels,
        :scale_list,
        :scale,
        :state,
        scale: []
      ).tap do |whitelisted|
        whitelisted[:scale_with_labels] = params[:scorer][:scale_with_labels]
      end
    end

    def set_scorer
      @scorer = Scorer.where(id: params[:id]).first

      render json: { error: 'Not Found!' }, status: :not_found unless @scorer
    end
  end
end
