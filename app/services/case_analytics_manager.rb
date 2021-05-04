# frozen_string_literal: true

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

      variance = ratings_variance(query.ratings).first[:rating] # change rating to something else for Nate

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

  def ratings_variance ratings
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

  def variance x
    m = mean(x)
    sum = 0.0
    x.each { |v| sum += (v - m)**2 }
    sum / (x.size - 1)
  end

  def mean x
    x.sum(0.0) / x.size
  end
end
