# frozen_string_literal: true

# rubocop:disable Metrics/ClassLength
class CaseAnalyticsManager
  attr_accessor :the_case, :errors

  def initialize the_case
    @the_case = the_case
  end

  # You need ratings from multiple people to calculate variances,
  # so we expose this only for cases shared with teams.
  def can_calculate_variances?
    !@the_case.teams.empty?
  end

  # for variances we need to know the max label used.
  def max_label
    @the_case.scorer.scale.last
  end

  # at the case level what is our rating variance?
  def case_ratings_variance
    case_variance_values = []
    @the_case.queries.each do |query|
      next if query.ratings.empty?

      # variance = ratings_variance(query.ratings).first[:rating] # change rating to something else for Nate
      variance = CaseAnalyticsManager.query_rating_variance_average_two(query)

      relative_variance = variance / max_label

      case_variance_values << relative_variance
    end

    mean(case_variance_values)
  end

  # at the query/doc pair level what is our rating variance?
  def query_doc_ratings_variance ratings
    variance_values = []

    variance = ratings_variance(ratings).first[:rating] # change rating to something else for Nate

    relative_variance = variance / max_label

    variance_values << relative_variance

    mean(variance_values)
  end

  # at the query level what is our rating variance?
  def query_ratings_variance _query_doc_ratings_variance_array
    variance_values = []

    variance = ratings_variance(ratings).first[:rating] # change rating to something else for Nate

    relative_variance = variance / max_label

    variance_values << relative_variance

    mean(variance_values)
  end

  def ratings_variance ratings
    ratings_by_doc = group_by_doc_id(ratings)

    ratings_variants = []

    ratings_by_doc.each do |_key, value|
      value[:rating] = variance(value[:ratings]).round(2)

      ratings_variants << { docid: value[:doc_id], query_id: value[:query_id], rating: value[:rating] }
    end
    ratings_variants
  end

  def ratings_variance2 ratings
    ratings_by_doc = group_by_doc_id(ratings)

    ratings_variants = []

    ratings_by_doc.each do |_key, value|
      value[:rating] = variance(value[:ratings]).round(2)

      ratings_variants << { docid: value[:doc_id], query_id: value[:query_id], rating: value[:rating] }
    end
    ratings_variants
  end

  def group_by_doc_id ratings
    ratings_by_doc = {}
    ratings.each do |rating|
      if ratings_by_doc.key? rating.doc_id
        ratings_by_doc[rating.doc_id][:ratings] << rating[:rating].to_f
      else
        ratings_by_doc[rating.doc_id] =
          { doc_id: rating[:doc_id], query_id: rating[:query_id], ratings: [ rating[:rating].to_f ] }
      end
    end
    ratings_by_doc
  end

  # create a hash where the keys are the doc_id and the value is
  # an array of ratings.  Doesn't deal with an empty ratings array.
  def self.group_by_doc_id_version_two ratings
    query = ratings.first.query
    ratings_by_doc = {}
    ratings.each do |rating|
      if rating.query != query
        puts "Something went wrong, Query id #{query.id} was expected but have #{rating.query.id}"
      end
      if ratings_by_doc.key? rating.doc_id
        ratings_by_doc[rating.doc_id] << rating
      else
        ratings_by_doc[rating.doc_id] = [ rating ]
      end
    end
    ratings_by_doc
  end

  def self.query_rating_variance_average_two query
    return 0 if query.ratings.empty?

    grouping = CaseAnalyticsManager.group_by_doc_id_version_two(query.ratings)

    variances = []
    grouping.each do |_key, ratings_for_doc|
      variances << CaseAnalyticsManager.variance_two(ratings_for_doc.map(&:rating).compact)
    end
    puts "Variances: #{variances}"
    variances = variances.reject(&:nan?)
    mean_two(variances).round(2)
  end

  def query_rating_variance_average x
    mean(x)
  end

  def variance x
    m = mean(x)
    sum = 0.0
    x.each { |v| sum += (v - m)**2 }
    sum / (x.size - 1)
  end

  def self.variance_two x
    m = mean_two(x)
    sum = 0.0
    x.each { |v| sum += (v - m)**2 }
    sum / (x.size - 1)
  end

  def self.mean_two x
    x.sum(0.0) / x.size
  end

  def mean x
    x.sum(0.0) / x.size
  end
end
# rubocop:enable Metrics/ClassLength
