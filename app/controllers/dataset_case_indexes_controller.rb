# frozen_string_literal: true

# Initiate indexing for one case made from a dataset: works out the index definition for the chosen search endpoint's
# engine from the canonical dataset index schema, shows it, and creates the index only when the user agrees.
class DatasetCaseIndexesController < ApplicationController
  before_action :set_link
  before_action :set_endpoint

  # What the index would be, for the user to look at first. Nothing is sent to the endpoint.
  def show
    build_definition
  end

  # The user has seen the definition, maybe changed it, and agreed: create the index as it now is, and point the case
  # at the endpoint. What comes back from the form is checked before anything is sent.
  def create
    build_definition
    return render_review(@unsupported || 'There is no index definition to create.') unless @definition&.applicable?

    @definition = @definition.edited(index_name: params[:index_name], text: params[:definition]) if params.key?(:definition)
    DatasetIndex::Applier.new(@endpoint).apply(@definition)
    @kase.tries.first.update!(search_endpoint: @endpoint)
    redirect_to dataset_cases_path, notice: "Created #{@definition.label} index #{@definition.index_name} on #{@endpoint.fullname}, and #{@kase.case_name} now searches it."
  rescue DatasetIndex::Error => e
    render_review(e.message)
  end

  private

  def set_link
    @link = CaseToDataset.joins(:dataset).where(datasets: { owner_id: current_user.id }).find(params.expect(:dataset_case_id))
    @kase = @link.case
    @entry = DatasetCatalog.find(@link.dataset.key)
    return redirect_to(dataset_cases_path, alert: "#{@kase.case_name} is still loading: try again when that has finished.") if @link.in_progress?

    redirect_to(dataset_cases_path, alert: "#{@kase.case_name} belongs to someone else, so its search endpoint cannot be changed from here.") unless @kase.owner_id == current_user.id
  end

  def set_endpoint
    @endpoint = current_user.search_endpoints_involved_with.not_archived.find_by(id: params.fetch(:search_endpoint_id, nil))
    redirect_to(dataset_cases_path, alert: 'Pick a search endpoint you can use.') unless @endpoint
  end

  # Qdrant needs the length of the vectors, which comes from the embedder the case uses, if it has one.
  def build_definition
    @proposed = @definition = DatasetIndex.build(endpoint: @endpoint, dataset: @entry, vector_size: @kase.embedder&.dimensions)
  rescue DatasetIndex::Unsupported => e
    @unsupported = e.message
  end

  # Back to the review with the reason, and what the user had typed, so a mistake does not cost them their edits.
  def render_review message
    @edited_name = params[:index_name]
    @edited_text = params[:definition]
    flash.now[:alert] = message
    render :show, status: :unprocessable_content
  end
end
