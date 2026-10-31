# frozen_string_literal: true

module DatasetIndex
  # What there is to know before creating a case's dataset index on a search endpoint: the definition proposed for the
  # endpoint's engine, whether the dataset is already indexed there, and whether its documents can be loaded. Only reads.
  class Review
    NO_INDEX_NAME = 'Quepid cannot find an index name in the selected endpoint. Please specify the index name.'

    attr_reader :link, :kase, :entry, :endpoint, :proposed, :unsupported, :documents, :why_not
    attr_accessor :definition

    def initialize link, endpoint
      @link = link
      @kase = link.case
      @entry = DatasetCatalog.find(link.dataset.key)
      @endpoint = endpoint
      build_definition
      describe_documents
    end

    # The endpoint's address should name its index (Elasticsearch's /tmdb/_search, Solr's /solr/shop/select) and does
    # not (/_search): the case would go on searching the address as it is, not the index Quepid made.
    def index_name_missing?
      @index_name_missing
    end

    # The definition to create as the user agreed to it: with their edit (index name and JSON text) when they made one.
    # Checked before anything is sent to the endpoint, whether Quepid sends it or the browser does. Raises Error saying
    # why it cannot be created.
    def agreed! index_name: nil, text: nil
      raise Error, "#{entry.name} is already indexed in #{endpoint.fullname}, so there is nothing to create or load there." if preindexed?
      raise Error, unsupported || 'There is no index definition to create.' unless definition&.applicable?

      self.definition = definition.edited(index_name: index_name, text: text) unless text.nil?
      definition
    end

    # The dataset's documents are in this endpoint already (Haystack's Chorus Solr), so there is nothing to create or load.
    def preindexed?
      @preindexed
    end

    # Can Quepid load the dataset's documents into this endpoint?
    def loadable?
      @loadable
    end

    # The name to offer for a new index: the dataset's own ("wands"), unless the endpoint's index already has it.
    def suggested_new_name
      builder = DatasetIndex.builder_for(endpoint)
      name = entry.key.to_s.dasherize
      name = builder.fallback_name(entry.key) if !builder.valid_name?(name) || name == proposed&.index_name
      name
    end

    private

    # Qdrant needs the length of the vectors, which comes from the embedder the case uses, if it has one.
    def build_definition
      return @preindexed = true if entry&.preindexed_in?(endpoint)

      builder = DatasetIndex.builder_for(endpoint)
      if builder.respond_to?(:url_with_index) && builder.index_name_from(endpoint.endpoint_url).nil?
        @index_name_missing = true
        return @unsupported = NO_INDEX_NAME
      end

      @proposed = @definition = DatasetIndex.build(endpoint: endpoint, dataset: entry, vector_size: kase.embedder&.dimensions)
    rescue DatasetIndex::Unsupported => e
      @unsupported = e.message
    end

    # Only for the engines Quepid has a loader for, and when Quepid has the dataset's documents. If not, says why.
    def describe_documents
      @documents = DatasetDocuments.count(entry, kase)
      engine = DatasetIndex.engine_id(endpoint)
      @loadable = @documents.positive? && DatasetIndex::Indexer.supports?(engine)
      return if @loadable

      label = definition&.label || SearchEngine.label(endpoint.search_engine)
      @why_not = if DatasetIndex::Indexer.supports?(engine)
                   "Quepid has no documents for #{entry&.name || 'this dataset'}"
                 else
                   "Quepid cannot load documents into #{label} yet"
                 end
    end
  end
end
