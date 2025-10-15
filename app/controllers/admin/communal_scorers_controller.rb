# frozen_string_literal: true

module Admin
  class CommunalScorersController < Admin::AdminController
    include Pagy::Backend

    # Properly we should only allow a user with Admin permissions to call this controller...
    before_action :set_scorer, only: [ :show, :edit, :update, :destroy ]

    def index
      query = Scorer.communal

      if params[:q].present?
        query = query.where('name LIKE ? OR scale_with_labels LIKE ?',
                            "%#{params[:q]}%", "%#{params[:q]}%")
      end

      @pagy, @scorers = pagy(query)
    end

    def show; end

    def new
      @scorer = Scorer.new
      @scorer.communal = true
    end

    def edit; end

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

    # DELETE /admin/communal_scorers/1
    # DELETE /admin/communal_scorers/1.json
    def destroy
      @scorer.destroy
      respond_to do |format|
        format.html { redirect_to admin_communal_scorers_url, notice: 'Scorer was successfully deleted.' }
        format.json { head :no_content }
      end
    end

    private

    def scorer_params
      return unless params[:scorer]

      params.expect(
        scorer: [ :code,
                  :name,
                  :communal,
                  :show_scale_labels,
                  :scale_list, # alternate approach to the scale:[] array used in admin only
                  :state,
                  { scale:             [],
                    scale_with_labels: {} } ]
      )
    end

    def set_scorer
      @scorer = Scorer.find(params[:id])

      render json: { error: 'Not Found!' }, status: :not_found unless @scorer
    end
  end
end
