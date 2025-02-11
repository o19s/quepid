# frozen_string_literal: true

class CaseScoreManager
  attr_accessor :the_case, :errors

  def initialize the_case
    @the_case = the_case
  end

  # rubocop:disable Metrics/MethodLength
  def update score_data
    score_data.deep_symbolize_keys!
    return nil if empty_score? score_data

    last_score = @the_case.last_score

    # puts "Do we have the same_score_source: #{same_score_source last_score, score_data}"
    if same_score_source last_score, score_data
      if user_ratings_docs? last_score, score_data
        update_params = {
          all_rated: score_data[:all_rated],
          queries:   score_data[:queries],
          score:     score_data[:score],
        }

        last_score.update update_params
        return last_score
      elsif same_score? last_score, score_data
        return last_score # ignore
      end
    end
    # Look up the try using the try_number if we passed that in.
    if score_data[:try_number]
      try = @the_case.tries.where(try_number: score_data[:try_number]).first
      # score_data.except!(:try_number)
      score_data[:try_id] = try.id
    end

    @score = @the_case.scores.build score_data.except(:try_number)
    saved = @score.save
    # rubocop:disable Rails/SkipsModelValidations
    if saved
      # for some reason the scorer isn't doing the :touch on the parent case
      @the_case.touch
      return @score
    end
    # rubocop:enable Rails/SkipsModelValidations

    @errors = @score.errors
    raise ActiveRecord::RecordInvalid, @score
  end
  # rubocop:enable Metrics/MethodLength

  private

  def empty_score? score_data
    return true if score_data[:score].blank?
    return true if score_data[:score].to_f.zero? && score_data[:queries].blank?

    false
  end

  def same_score_source last_score, score_data
    return false if last_score.blank?
    # return false if last_score.try_id.blank?

    # we have an issue where the case_score.try_id table references tries.id and
    # the try doesn't exist. So the last_score.try is nil.  Maybe related to deleting a try?
    return false if last_score&.try&.nil?
    return false if last_score.try.try_number != score_data[:try_number].to_i
    return false if last_score.user_id != score_data[:user_id].to_i
    return false if last_score.scorer_id != score_data[:scorer_id].to_i

    true
  end

  def user_ratings_docs? last_score, score_data
    return false if last_score.updated_at.blank?
    return false if last_score.score == score_data[:score]
    return false if last_score.updated_at < 5.minutes.ago

    true
  end

  def same_score? last_score, score_data
    return false if last_score.updated_at.blank?

    return false unless same_number? last_score, score_data
    return false if     last_score_old? last_score
    return false if     added_query? last_score, score_data

    true
  end

  def same_number? last_score, score_data
    last_score.score.to_i == score_data[:score].to_i
  end

  def last_score_old? last_score
    last_score.updated_at < 1.day.ago
  end

  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/PerceivedComplexity
  def added_query? last_score, score_data
    return true  if last_score.nil? && !score_data.empty?
    return false if last_score.nil? && score_data.empty?
    return false if queries_empty?(last_score.queries) && queries_empty?(score_data[:queries])
    return false if queries_empty?(last_score.queries)

    last_score_queries = {}
    score_data_queries = {}
    last_score.queries.each do |key, value|
      last_score_queries[key.to_s] = value.symbolize_keys
    end
    score_data[:queries].each do |key, value|
      score_data_queries[key.to_s] = value.symbolize_keys
    end

    last_score_queries != score_data_queries
  end
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/PerceivedComplexity

  def queries_empty? queries
    queries.blank?
  end
end
