# frozen_string_literal: true

# Initiate indexing for one case made from a dataset: works out the index definition for the chosen search endpoint's
# engine from the canonical dataset index schema and shows it. Then, depending on the engine:
#
# * where Quepid can create indexes (Elasticsearch, OpenSearch, Solr, Qdrant), it creates the index when the user
#   agrees, and loads the dataset's documents into it where it can (create);
# * where it cannot (Vespa, Algolia, Vectara), the user deploys the definition themselves, and when they say they
#   have, Quepid loads the documents where it can (DatasetCaseIndexes::DocumentsController#create).
#
# For an endpoint that is not proxied, the browser creates the index and loads the documents itself, and create only sets
# the case up (see browser_index_controller.js): its request says applied. The browser has the definition checked first
# (DatasetCaseIndexes::ValidationsController), so it sends the endpoint only what create would.
class DatasetCaseIndexesController < ApplicationController
  include DatasetCaseScoped

  before_action :set_review

  helper_method :new_index_chosen?

  # What the index would be, for the user to look at first. Nothing is sent to the endpoint.
  def show
  end

  # The user has seen the definition, maybe changed it, and agreed: create the index as it now is, and point the case
  # at the endpoint. What comes back from the form is checked before anything is sent.
  def create
    @review.agreed!(index_name: params[:index_name], text: params[:definition])
    # The index is created, and the documents loaded, where the case will search: for a new index that is the copy's
    # address, not the chosen endpoint's (for Solr, /solr/wands/schema rather than /solr/shop/schema).
    @target = new_endpoint_for(@review.definition.index_name) || @endpoint
    DatasetIndex::Applier.new(@target).apply(@review.definition) unless applied_by_browser?
    @target.save! if @target.new_record?
    notice = "#{created_message} #{start_indexing(@review.definition.index_name)}"

    if applied_by_browser?
      flash[:notice] = notice
      render json: { redirect: dataset_cases_path, load: @review.loadable?, total: @review.documents }
    else
      redirect_to dataset_cases_path, notice: notice, status: :see_other
    end
  rescue DatasetIndex::Error => e
    render_review(e.message)
  end

  private

  def set_review
    @review = DatasetIndex::Review.new(@link, @endpoint)
  end

  # "Create a new index on the same service" is chosen, not the endpoint's own index.
  def new_index_chosen?
    deserialize_bool_param(params[:new_endpoint])
  end

  # The browser has already created the index itself, and loads the documents itself.
  def applied_by_browser?
    deserialize_bool_param(params[:applied])
  end

  # With "Create a new index on the same service" chosen: a copy of the chosen endpoint, with its connection details,
  # that searches the new index, not saved until the index is there. Nil when the endpoint's own index is used, or its
  # address cannot name an index.
  def new_endpoint_for index_name
    return unless new_index_chosen?

    DatasetIndex.endpoint_for_index(@endpoint, index_name, current_user)
  end

  # Points the case at the new index. Where Quepid knows the engine's query language the case gets a new try with a
  # starter query for it (the old try stays in its history); otherwise its latest try just takes the endpoint.
  def created_message
    definition = @review.definition
    new_try = DatasetIndex::SearchSetup.new(@kase, @target).apply
    unless new_try
      @kase.tries.first.update!(search_endpoint: @target)
      return "Created #{definition.label} index #{definition.index_name} on #{@endpoint.fullname}, and #{@kase.case_name} now searches it."
    end

    "Created #{definition.label} index #{definition.index_name} on #{@endpoint.fullname}. #{@kase.case_name} now searches it, " \
      "with a starter query as Try #{new_try.try_number} (its earlier settings are still in its history)."
  end

  # Queues the documents to be indexed into the index, if Quepid can load them (the browser loads them itself when it
  # made the index), and says what happened.
  def start_indexing index_name
    return "No documents were indexed: #{@review.why_not}." unless @review.loadable?

    @link.start_indexing!(index_name, in_browser: applied_by_browser?)
    return "Its #{helpers.number_with_delimiter(@review.documents)} documents are being indexed from your browser: keep that page open until it says it is done." if applied_by_browser?

    IndexDatasetDocumentsJob.perform_later(@link, @target, index_name)
    "Its #{helpers.number_with_delimiter(@review.documents)} documents are being indexed in the background."
  end

  # Back to the review with the reason, and what the user had typed, so a mistake does not cost them their edits.
  def render_review message
    return render(json: { error: message }, status: :unprocessable_content) if applied_by_browser?

    @edited_name = params[:index_name]
    @edited_text = params[:definition]
    flash.now[:alert] = message
    render :show, status: :unprocessable_content
  end
end
