# frozen_string_literal: true

# Initiate indexing for one case made from a dataset: works out the index definition for the chosen search endpoint's
# engine from the canonical dataset index schema and shows it. Then, depending on the engine:
#
# * where Quepid can create indexes (Elasticsearch, OpenSearch, Solr, Qdrant), it creates the index when the user
#   agrees, and loads the dataset's documents into it where it can (create);
# * where it cannot (Vespa, Algolia, Vectara), the user deploys the definition themselves, and when they say they
#   have, Quepid loads the documents where it can (documents). Quepid creates and loads nothing before that.
class DatasetCaseIndexesController < ApplicationController
  include ActionController::Live

  before_action :set_link
  before_action :set_endpoint

  # What the index would be, for the user to look at first. Nothing is sent to the endpoint.
  def show
    build_definition
    describe_documents
  end

  helper_method :suggested_new_name

  # The user has seen the definition, maybe changed it, and agreed: create the index as it now is, and point the case
  # at the endpoint. What comes back from the form is checked before anything is sent.
  def create
    build_definition
    describe_documents
    return render_review(already_indexed_message) if @preindexed
    return render_review(@unsupported || 'There is no index definition to create.') unless @definition&.applicable?

    @definition = @definition.edited(index_name: params[:index_name], text: params[:definition]) if params.key?(:definition)
    # When the browser made the index itself (the endpoint is one only it can reach), it has already been created.
    browser = 'true' == params[:applied].to_s
    DatasetIndex::Applier.new(@endpoint).apply(@definition) unless browser
    @target = new_endpoint_for(@definition.index_name) || @endpoint
    notice = "#{created_message} #{browser ? start_browser_indexing(@definition.index_name) : start_indexing(@definition.index_name)}"
    return redirect_to(dataset_cases_path, notice: notice) unless browser

    flash[:notice] = notice
    render json: { redirect: dataset_cases_path, load: @loadable, total: @documents }
  rescue DatasetIndex::Error => e
    render_review(e.message)
  end

  # The user has deployed the definition themselves, where Quepid cannot create it, and says to start loading.
  def documents
    build_definition
    describe_documents
    return render_review(already_indexed_message) if @preindexed
    return render_review(@unsupported || 'Quepid creates this index itself: use the button above.') if @definition.nil? || @definition.applicable?
    return render_review("#{@no_documents_because}, so there is nothing to load.") unless @loadable

    name = params[:index_name].to_s.strip
    return render_review("#{name.inspect} is not a name #{@definition.label} accepts for an index.") unless DatasetIndex.builder_for(@endpoint).valid_name?(name)

    @kase.tries.first.update!(search_endpoint: @endpoint)
    redirect_to dataset_cases_path, notice: "#{@kase.case_name} now searches #{@endpoint.fullname}. #{start_indexing(name)}"
  end

  # The documents of the case's dataset, one canonical document per line, for the browser to send to the service itself.
  def stream
    describe_documents
    return head(:unprocessable_content) unless @loadable

    response.headers['Content-Type'] = 'application/x-ndjson'
    response.headers['Cache-Control'] = 'no-store'
    DatasetDocuments.canonical(@entry, @kase).each { |doc| response.stream.write("#{doc.to_json}\n") }
  rescue WandsData::Error => e
    response.stream.write("#{{ error: e.message }.to_json}\n")
  ensure
    response.stream.close
  end

  # How far the browser has got in loading the documents, for the Dataset Cases tab.
  def progress
    status = %w[indexing done failed].include?(params[:status]) ? params[:status] : 'indexing'
    @link.update!(indexing_status: status, documents_indexed: params[:documents_indexed].to_i,
                  indexing_error: ('failed' == status ? params[:error].to_s.truncate(1000) : nil))
    head :no_content
  end

  # Is the name free on the endpoint's service? Answers the review page's Check availability button, as JSON.
  def availability
    name = params[:index_name].to_s.strip
    builder = DatasetIndex.builder_for(@endpoint)
    return render(json: { status: 'unsupported', message: "Quepid cannot check names on #{SearchEngine.label(@endpoint.search_engine)}." }) unless DatasetIndex::Availability.supports?(@endpoint)
    return render(json: { status: 'invalid', message: "#{name.inspect} is not a name #{builder::LABEL} accepts for an index." }) unless builder.valid_name?(name)

    taken = DatasetIndex::Availability.new(@endpoint).taken?(name)
    render json: { status: taken ? 'taken' : 'free', message: taken ? "#{name} is already there on #{@endpoint.fullname}." : "#{name} is free." }
  rescue DatasetIndex::Error => e
    render json: { status: 'unknown', message: e.message }
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

  # With "Create a new search endpoint" ticked: a copy of the chosen endpoint, with its connection details, that searches
  # the new index. Nil when not asked for or the engine's address cannot name an index.
  def new_endpoint_for index_name
    return unless params[:new_endpoint].present? && '0' != params[:new_endpoint]

    copy = DatasetIndex.endpoint_for_index(@endpoint, index_name, current_user)
    copy&.tap(&:save!)
  end

  # The name to offer for a new index: the dataset's own ("wands"), unless the endpoint's index already has it.
  def suggested_new_name
    builder = DatasetIndex.builder_for(@endpoint)
    name = @entry.key.to_s.dasherize
    name = builder.fallback_name(@entry.key) if !builder.valid_name?(name) || name == @proposed&.index_name
    name
  end

  # Qdrant needs the length of the vectors, which comes from the embedder the case uses, if it has one.
  def build_definition
    return @preindexed = true if @entry&.preindexed_in?(@endpoint)

    @proposed = @definition = DatasetIndex.build(endpoint: @endpoint, dataset: @entry, vector_size: @kase.embedder&.dimensions)
  rescue DatasetIndex::Unsupported => e
    @unsupported = e.message
  end

  # Can the dataset's documents be loaded into this endpoint? Only for the engines Quepid has a loader for, and when
  # Quepid has the dataset's documents. If not, says why, for the review page to show.
  def describe_documents
    @documents = DatasetDocuments.count(@entry, @kase)
    engine = DatasetIndex.engine_id(@endpoint)
    @loadable = @documents.positive? && DatasetIndex::Indexer.supports?(engine)
    return if @loadable

    label = @definition&.label || SearchEngine.label(@endpoint.search_engine)
    @no_documents_because = if DatasetIndex::Indexer.supports?(engine)
                              "Quepid has no documents for #{@entry&.name || 'this dataset'}"
                            else
                              "Quepid cannot load documents into #{label} yet"
                            end
  end

  def already_indexed_message
    "#{@entry.name} is already indexed in #{@endpoint.fullname}, so there is nothing to create or load there."
  end

  # Points the case at the new index. Where Quepid knows the engine's query language the case gets a new try with a
  # starter query for it (the old try stays in its history); otherwise its latest try just takes the endpoint.
  def created_message
    new_try = DatasetIndex::SearchSetup.new(@kase, @target).apply
    unless new_try
      @kase.tries.first.update!(search_endpoint: @target)
      return "Created #{@definition.label} index #{@definition.index_name} on #{@endpoint.fullname}, and #{@kase.case_name} now searches it."
    end

    "Created #{@definition.label} index #{@definition.index_name} on #{@endpoint.fullname}. #{@kase.case_name} now searches it, " \
      "with a starter query as Try #{new_try.try_number} (its earlier settings are still in its history)."
  end

  # Queues the documents to be indexed into the index, if Quepid can load them, and says what happened.
  def start_indexing index_name
    return "No documents were indexed: #{@no_documents_because}." unless @loadable

    @link.update!(index_name: index_name, indexing_status: 'pending', documents_indexed: 0, indexing_error: nil)
    IndexDatasetDocumentsJob.perform_later(@link, @endpoint, index_name)
    "Its #{helpers.number_with_delimiter(@documents)} documents are being indexed in the background."
  end

  # The browser loads the documents itself: the link says so, and it reports its progress.
  def start_browser_indexing index_name
    return "No documents were indexed: #{@no_documents_because}." unless @loadable

    @link.update!(index_name: index_name, indexing_status: 'indexing', documents_indexed: 0, indexing_error: nil)
    "Its #{helpers.number_with_delimiter(@documents)} documents are being indexed from your browser: keep that page open until it says it is done."
  end

  # Back to the review with the reason, and what the user had typed, so a mistake does not cost them their edits.
  def render_review message
    @edited_name = params[:index_name]
    @edited_text = params[:definition]
    flash.now[:alert] = message
    render :show, status: :unprocessable_content
  end
end
