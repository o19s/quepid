# frozen_string_literal: true

# The example datasets Quepid knows about, loadable or not. What a user has made from one is a
# Dataset record, matched by key.
module DatasetCatalog
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
      license:           'Apache 2.0, as part of Quepid',
      license_url:       'https://github.com/o19s/quepid/blob/main/LICENSE',
      available:         true,
      loader:            HaystackDataset,
      default_case_name: 'Haystack Rating Party',
      query_total:       137,
      mapper:            DatasetDocumentMappers::Haystack,
      documents_from:    :book,
      preindexed_url:    'http://chorus.dev.o19s.com:8983/solr/ecommerce/select',
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
      license:     'Apache 2.0',
      license_url: 'https://github.com/amazon-science/esci-data/blob/main/LICENSE',
      available:   false
    ),
    Entry.new(
      key:               'wands',
      name:              'WANDS',
      description:       'Wayfair ANnotation Dataset: furniture and home-goods queries with graded product relevance labels. ' \
                         "Downloaded from Wayfair's GitHub (MIT licence) when a case is made.",
      queries:           '480 queries',
      documents:         '42,994 products (name, description, category, average rating)',
      judgements:        '233,448 labels on 231,873 query-product pairs',
      labels:            '0 Irrelevant, 1 Partial, 2 Exact',
      url:               'https://github.com/wayfair/WANDS',
      license:           'MIT',
      license_url:       'https://github.com/wayfair/WANDS/blob/main/LICENSE',
      available:         true,
      loader:            WandsDataset,
      default_case_name: 'WANDS',
      query_total:       480,
      mapper:            DatasetDocumentMappers::Wands,
      documents_from:    :wands,
      document_total:    42_994,
      scale_labels:      { '0' => 'Irrelevant', '1' => 'Partial', '2' => 'Exact' }
    ),
    Entry.new(
      key:               'home_depot',
      name:              'Home Depot Product Search Relevance',
      description:       'Kaggle competition data: Home Depot search terms with products and human-rated relevance scores. ' \
                         'Kaggle wants a login and its rules accepted, so you upload the files; they are deleted once imported.',
      queries:           "The search terms of the competition's train.csv",
      documents:         'The rated products, with title, description and brand',
      judgements:        'Human-rated relevance scores, one per search term and product',
      labels:            '0 Irrelevant, 1 Partially relevant, 2 Perfect match (the 1 to 3 average of the raters, rounded)',
      url:               'https://www.kaggle.com/competitions/home-depot-product-search-relevance/data',
      license:           "The competition's rules, accepted on Kaggle",
      license_url:       'https://www.kaggle.com/competitions/home-depot-product-search-relevance/rules',
      available:         true,
      upload:            HomeDepotData,
      loader:            HomeDepotDataset,
      default_case_name: 'Home Depot Product Search Relevance',
      mapper:            DatasetDocumentMappers::HomeDepot,
      documents_from:    :book,
      scale_labels:      { '0' => 'Irrelevant', '1' => 'Partially relevant', '2' => 'Perfect match' }
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
      license:           'Personal and non-commercial use only',
      license_url:       'https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX',
      available:         false,
      loader:            ImdbDataset,
      default_case_name: ImdbDataset::CASE_NAME,
      query_total:       ImdbDataset::QUERIES.size,
      mapper:            DatasetDocumentMappers::Imdb
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
