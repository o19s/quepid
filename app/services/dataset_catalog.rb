# frozen_string_literal: true

# The example datasets Quepid knows about, loadable or not. What a user has made from one is a
# Dataset record, matched by key.
module DatasetCatalog
  # One example dataset. The Dataset model holds what a user has made from one.
  Entry = Struct.new(:key, :name, :description, :queries, :documents, :judgements, :labels, :url, :available, :loader,
                     :default_case_name, :scale_labels, :query_total, keyword_init: true) do
    # Can a sample of its queries be asked for? Only when we know how many it has.
    def sampleable?
      query_total.present?
    end

    # The rating values the dataset carries, from its labels ({ '0' => 'Poor', ... }); nil for a dataset without ratings.
    def scale
      scale_labels.keys.map(&:to_i).sort if scale_labels
    end

    # Can a scorer rate every label this dataset carries? A dataset without ratings fits any.
    def accepts? scorer
      scale.blank? || (scale - Array(scorer.scale)).empty?
    end

    # The dialog offers to create the dataset's own scorer, when the user does not have it yet.
    def needs_new_scorer? custom
      scale_labels.present? && custom.nil?
    end

    # What the create dialog preselects. For a dataset with labels, its own scorer (custom): the user's if
    # they have one, else a new one built from the labels ('new'). Otherwise any scorer that fits, the user's
    # default first, then nDCG@10.
    def preselected_scorer scorers, default, custom
      return custom&.id || 'new' if scale_labels.present?

      candidates = [ default, scorers.find { |scorer| 'nDCG@10' == scorer.name }, *scorers ].compact
      candidates.find { |scorer| accepts?(scorer) }&.id
    end
  end

  ENTRIES = [
    Entry.new(
      key:               'haystack',
      name:              'Haystack Rating Party',
      description:       '137 e-commerce queries rated at the Haystack conference rating party, with the judgement book behind them.',
      queries:           '137 queries',
      documents:         '1,558 documents (2,420 query-document pairs, with their fields)',
      judgements:        '1,679 case ratings and 1,942 book judgements',
      labels:            '0 Poor, 1 Fair, 2 Good, 3 Perfect',
      url:               'https://haystackconf.com',
      available:         true,
      loader:            HaystackDataset,
      default_case_name: 'Haystack Rating Party',
      query_total:       137,
      scale_labels:      { '0' => 'Poor', '1' => 'Fair', '2' => 'Good', '3' => 'Perfect' }
    ),
    Entry.new(
      key:         'esci',
      name:        'ESCI',
      description: 'Amazon Shopping Queries: queries with products judged Exact, Substitute, Complement or Irrelevant.',
      queries:     'About 130,000 queries',
      documents:   'About 1.8 million products with titles and descriptions',
      judgements:  'About 2.6 million',
      labels:      'Exact, Substitute, Complement, Irrelevant',
      url:         'https://github.com/amazon-science/esci-data',
      available:   false
    ),
    Entry.new(
      key:         'wands',
      name:        'WANDS',
      description: 'Wayfair ANnotation Dataset: furniture and home-goods queries with graded product relevance labels.',
      queries:     'About 480 queries',
      documents:   'About 43,000 products',
      judgements:  'About 233,000',
      labels:      'Exact, Partial, Irrelevant',
      url:         'https://github.com/wayfair/WANDS',
      available:   false
    ),
    Entry.new(
      key:         'home_depot',
      name:        'Home Depot Product Search Relevance',
      description: 'Kaggle competition data: Home Depot search terms with products and human-rated relevance scores.',
      queries:     'Search terms',
      documents:   'Product titles, descriptions and attributes',
      judgements:  'Human-rated relevance scores',
      labels:      '1 to 3, averaged over raters (decimals like 2.33)',
      url:         'https://www.kaggle.com/competitions/home-depot-product-search-relevance/data',
      available:   false
    ),
    Entry.new(
      key:               'imdb',
      name:              'IMDb Non-Commercial Datasets',
      description:       'IMDb title catalogue as a movie corpus to index and search. Creates a case with starter queries and no search endpoint.',
      queries:           '10 starter queries (rambo, star wars, comedy, funny movies, sad movies and more)',
      documents:         'None loaded: index the IMDb titles, genres, years and crew in your own search engine',
      judgements:        'None: rate the results yourself or with an AI judge',
      labels:            'None, pick a scorer on the case',
      url:               'https://developer.imdb.com/non-commercial-datasets/',
      available:         true,
      loader:            ImdbDataset,
      default_case_name: ImdbDataset::CASE_NAME,
      query_total:       ImdbDataset::QUERIES.size
    )
  ].freeze

  def self.find key
    ENTRIES.find { |entry| entry.key == key }
  end

  # Loadable first; sort_by isn't stable, so each group keeps the listed order.
  def self.loadable_first
    ENTRIES.each_with_index.sort_by { |entry, index| [ entry.available ? 0 : 1, index ] }.map(&:first)
  end
end
