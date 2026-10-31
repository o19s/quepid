# frozen_string_literal: true

module DatasetCatalog
  # One example dataset. The Dataset model holds what a user has made from one.
  Entry = Struct.new(:key, :name, :description, :queries, :documents, :judgements, :labels, :url, :available, :loader,
                     :default_case_name, :scale_labels, :query_total, :mapper, :documents_from, :document_total, :preindexed_url, :upload, :license, :license_url,
                     keyword_init: true) do
    # license: the terms the dataset comes under, in a few words, and license_url where they are set out.
    # upload: for a dataset the user has to fetch themselves (Kaggle's, behind a login and rules), what keeps the files
    # they upload (HomeDepotData).
    # Is the dataset already indexed in this endpoint, by someone else? Haystack's is, in the Chorus Solr its export names,
    # so there is no index to propose or create there.
    def preindexed_in? endpoint
      preindexed_url.present? && endpoint.endpoint_url.to_s.strip.chomp('/') == preindexed_url
    end

    # Can a case be made from it now? Not one whose files the user uploads (Home Depot's) until they are there.
    def loadable?
      available && (upload.nil? || upload.uploaded?)
    end

    # How many queries it has: for an uploaded dataset, counted in what was uploaded (nil until it is).
    def query_total
      upload ? upload.query_total : self[:query_total]
    end

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
end
