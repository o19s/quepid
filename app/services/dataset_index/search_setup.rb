# frozen_string_literal: true

module DatasetIndex
  # Gives a case the means to search the canonical index it was just given: a new try, with the endpoint and a starter
  # query written for the canonical fields (title, brand, description, category) in the engine's own query language.
  # A new try, not a change to the old one, so what the case had before stays in its history. Only for the engines whose
  # query format is known; the others keep their try as it is.
  class SearchSetup
    # Quoted heredoc: the #$query## placeholder is Quepid's, not Ruby interpolation.
    ELASTICSEARCH_QUERY = <<~'JSON'.strip
      {
        "query": {
          "multi_match": {
            "query": "#$query##",
            "type": "best_fields",
            "fields": ["title^3", "brand^2", "description", "category"]
          }
        }
      }
    JSON

    # engine id => what a try needs to search the canonical index. Quepid reads an Elasticsearch hit's id from _id, which is
    # the id the documents were indexed under.
    STARTERS = {
      'es'   => { query_params: ELASTICSEARCH_QUERY, field_spec: 'id:_id, title:title, thumb:thumb, brand, category' },
      'os'   => { query_params: ELASTICSEARCH_QUERY, field_spec: 'id:_id, title:title, thumb:thumb, brand, category' },
      'solr' => { query_params: 'q=#$query##&defType=edismax&qf=title^3 brand^2 description category',
                  field_spec:   'id:id, title:title, thumb:thumb, brand, category' },
    }.freeze

    def self.supports? engine_id
      STARTERS.key?(engine_id)
    end

    def initialize kase, endpoint
      @kase = kase
      @endpoint = endpoint
      @engine_id = DatasetIndex.engine_id(endpoint)
    end

    # The new try, or nil when Quepid does not know this engine's query language.
    def apply
      return unless self.class.supports?(@engine_id)

      latest = @kase.tries.first
      number = (@kase.last_try_number || latest&.try_number || 0) + 1
      starter = STARTERS.fetch(@engine_id)
      try = @kase.tries.build(name: "#{SearchEngine.label(@engine_id)} starter query".truncate(50), search_endpoint: @endpoint,
                              query_params: starter[:query_params], field_spec: starter[:field_spec],
                              number_of_rows: latest&.number_of_rows || 10, escape_query: latest.nil? || latest.escape_query)
      try.parent = latest
      try.try_number = number
      @kase.last_try_number = number
      save_keeping_the_ancestry_short(try)
      try
    end

    private

    # The chain of ancestors is a column of limited length: when it is full, this try starts a new chain, as Quepid does
    # when a user saves a try.
    def save_keeping_the_ancestry_short try
      @kase.save!
    rescue ActiveRecord::ValueTooLong
      try.parent = nil
      @kase.save!
    end
  end
end
