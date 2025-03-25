# frozen_string_literal: true

class HomeController < ApplicationController
  before_action :set_case, only: [ :case_prophet, :run_case_evaluation_job ]
  before_action :set_book_no_track, only: [ :book_summary_detail ]
  before_action :check_for_announcement, only: [ :show ]

  def show
    # with_counts adds a `case.queries_count` field, which avoids loading
    # all queries and makes bullet happy.
    # @cases = recent_cases(30)
    @cases = @current_user.cases_involved_with.not_archived.with_counts
      .includes([ :metadata ])
      .order('`case_metadata`.`last_viewed_at` DESC, `cases`.`id` DESC')
      .limit(30)

    @most_recent_cases = @cases[0...4].sort_by { |c| c.case_name.downcase }

    @most_recent_books = recent_books(4)

    # @lookup_for_books = {}
    # @most_recent_books.each do |book|
    #  judged_by_current_user = book.judgements.where(user: @current_user).count
    #  if judged_by_current_user.positive? && judged_by_current_user < book.query_doc_pairs.size
    #    @lookup_for_books[book] = book.query_doc_pairs.size - judged_by_current_user
    #  end
    # end

    @most_recent_books = @most_recent_books.sort_by { |b| b.name.downcase }

    # Homepage is too slow so we have to cut some stuff out ;-(
    # candidate_cases = @cases.select { |kase| kase.scores.scored.count.positive? }
    # @grouped_cases = candidate_cases.group_by { |kase| kase.case_name.split(':').first }
    # @grouped_cases = @grouped_cases.select { |_key, value| value.count > 1 }
  end

  def sparklines
    render layout: false
  end

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/PerceivedComplexity
  def case_prophet
    # Check if the request is fresh based on the ETag
    if stale?(etag: @case, public: true)

      puts "we have decided we are stale for case #{@case.id} at #{@case.updated_at}"

      scores = @case.scores.where(scorer: @case.scorer)

      unless scores.empty?
        @for_single_day = scores.first.updated_at.all_day.overlaps?(scores.last.updated_at.all_day)
        @final = @case.scores.last_one.score
      end

      data = scores.collect do |score|
        if @for_single_day
          { ds: score.updated_at.to_fs(:db), y: score.score, datetime: score.updated_at }
        else
          { ds: score.updated_at.to_date.to_fs(:db), y: score.score, datetime: score.updated_at.to_date }
        end
      end.uniq

      # warning! blunt filter below!
      data = data.uniq { |h| h[:ds] }
      data = data.map { |h| h.transform_keys(&:to_s) }

      do_changepoints = data.length >= 3 # need at least 3...
      if do_changepoints

        df = Rover::DataFrame.new(data)
        m = Prophet.new
        m.fit(df)

        last_changepoint = DateTime.parse(m.changepoints.last.to_s)
        initial = data.find { |h| h['datetime'].all_day.overlaps?(last_changepoint.all_day) }['y']
        changepoint = 100 * (@final - initial) / initial

      end

      vega_data = data.map { |d| { x: d['ds'], y: d['y'] } }

      @prophet_case_data = {
        initial:          initial,
        final:            @final,
        changepoint:      changepoint.nil? ? 0 : changepoint,
        last_changepoint: last_changepoint,
        vega_data:        vega_data,
      }
      render layout: false
    end
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/PerceivedComplexity

  def book_summary_detail
    if stale?(etag: @book, public: true)

      puts "we have decided we are stale for book #{@book.id} at #{@book.updated_at}"
      render layout: false
    end
  end

  def run_case_evaluation_job
    last_try_number = if params[:try_number].present?
                        params[:try_number].to_i
                      else
                        @case.last_try_number
                      end
    puts "last_try_number: #{last_try_number}"
    @try = @case.tries.where(try_number: last_try_number).first
    RunCaseEvaluationJob.perform_later @case, @try, user: @current_user
    redirect_to root_path,
                notice: "Starting evaluation of queries for case #{@case.case_name} using try #{@try.name} now."
  end

  private

  def check_for_announcement
    @announcement = Announcement.where(live: true).latest_unseen_for_user(@current_user).first if @current_user
    AnnouncementViewed.create(user: @current_user, announcement: @announcement) if @announcement
  end
end
