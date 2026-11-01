# frozen_string_literal: true

module DatasetCaseIndexes
  # The documents of a case's dataset, to load into the index on a search endpoint.
  class DocumentsController < ApplicationController
    include ActionController::Live
    include DatasetCaseScoped

    before_action :set_review

    # One canonical document per line, for the browser to send to the service itself.
    def show
      return head(:unprocessable_content) unless @review.loadable?

      response.headers['Content-Type'] = 'application/x-ndjson'
      response.headers['Cache-Control'] = 'no-store'
      DatasetDocuments.canonical(@entry, @kase).each { |doc| response.stream.write("#{doc.to_json}\n") }
    rescue WandsData::Error => e
      response.stream.write("#{{ error: e.message }.to_json}\n")
    ensure
      response.stream.close
    end

    # The user has deployed the definition themselves, where Quepid cannot create it, and says to start loading: creates
    # nothing, points the case at the endpoint and loads the documents where it can.
    def create
      return back_to_review(already_indexed_message) if @review.preindexed?
      return back_to_review(@review.unsupported || 'Quepid creates this index itself: use the button above.') if @review.definition.nil? || @review.definition.applicable?
      return back_to_review("#{@review.why_not}, so there is nothing to load.") unless @review.loadable?

      name = params[:index_name].to_s.strip
      return back_to_review("#{name.inspect} is not a name #{@review.definition.label} accepts for an index.") unless DatasetIndex.builder_for(@endpoint).valid_name?(name)

      @kase.tries.first.update!(search_endpoint: @endpoint)
      @link.start_indexing!(name)
      IndexDatasetDocumentsJob.perform_later(@link, @endpoint, name)
      redirect_to dataset_cases_path, status: :see_other, notice: "#{@kase.case_name} now searches #{@endpoint.fullname}. " \
                                                                  "Its #{helpers.number_with_delimiter(@review.documents)} documents are being indexed in the background."
    end

    private

    def set_review
      @review = DatasetIndex::Review.new(@link, @endpoint)
    end

    def already_indexed_message
      "#{@entry.name} is already indexed in #{@endpoint.fullname}, so there is nothing to create or load there."
    end

    def back_to_review message
      redirect_to dataset_case_index_path(@link, search_endpoint_id: @endpoint.id), alert: message, status: :see_other
    end
  end
end
