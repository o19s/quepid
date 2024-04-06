# frozen_string_literal: true

class HomeController < ApplicationController
  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/PerceivedComplexity
  def show
    @cases = @current_user.cases_involved_with.not_archived.with_counts.includes([ :metadata ]).order('`case_metadata`.`last_viewed_at` DESC, `cases`.`id` DESC')
    # @most_recent_cases = recent_cases(4).sort_by { |c| c.case_name.downcase }
    @most_recent_cases = @cases[0...4].sort_by { |c| c.case_name.downcase }

    # Run the prophet!
    @prophet_case_data = {}
    @most_recent_cases.each do |kase|
      data = kase.scores.sampled(kase.id, 25).collect do |score|
        { ds: score.created_at.to_date.to_fs(:db), y: score.score, datetime: score.created_at.to_date }
      end.uniq
      # warning! blunt filter below!
      data = data.uniq { |h| h[:ds] }
      data = data.map { |h| h.transform_keys(&:to_s) }

      do_changepoints = data.length >= 3 # need at least 3...

      next unless do_changepoints

      df = Rover::DataFrame.new(data)
      m = Prophet.new
      m.fit(df)

      last_changepoint = DateTime.parse(m.changepoints.last.to_s)
      initial = data.find { |h| h['datetime'].all_day.overlaps?(last_changepoint.all_day) }['y']
      final = kase.scores.last_one.score
      change = 100 * (final - initial) / initial

      vega_data = data.map { |d| { x: d['ds'], y: d['y'] } }

      @prophet_case_data[kase.id] = {
        initial:          initial,
        final:            final,
        change:           change,
        last_changepoint: last_changepoint,
        vega_data:        vega_data,
      }
    end

    @most_recent_books = recent_books(4)
    @lookup_for_books = {}
    @most_recent_books.each do |book|
      judged_by_current_user = book.judgements.where(user: @current_user).count
      if judged_by_current_user.positive? && judged_by_current_user < book.query_doc_pairs.count
        @lookup_for_books[book] = book.query_doc_pairs.count - judged_by_current_user
      end
    end

    @most_recent_books.sort_by!(&:name)

    # Homepage is too slow so we have to cut some stuff out ;-(
    # candidate_cases = @cases.select { |kase| kase.scores.scored.count.positive? }
    # @grouped_cases = candidate_cases.group_by { |kase| kase.case_name.split(':').first }
    # @grouped_cases = @grouped_cases.select { |_key, value| value.count > 1 }
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/PerceivedComplexity
end
