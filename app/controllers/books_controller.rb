# frozen_string_literal: true

class BooksController < ApplicationController
  include Pagy::Method
  include BookScorerAssignment
  include BooksHelper

  before_action :set_book,
                only: [ :show, :edit, :update, :destroy, :combine, :assign_anonymous, :delete_ratings_by_assignee,
                        :reset_unrateable, :reset_judge_later, :delete_query_doc_pairs_below_position,
                        :eric_steered_us_wrong, :remap_judgement_ratings, :run_judge_judy, :cancel_judge_judy, :judge_overview, :judge_activity, :judgement_stats, :export, :archive, :unarchive ]

  before_action :find_user, only: [ :reset_unrateable, :reset_judge_later, :delete_ratings_by_assignee ]

  respond_to :html

  # We use "scorer_id" in book_params as a virtual attribute.
  # Since all the scale related attributes are mastered by a scorer data,
  # we use the scorer_id to pluck the scale etc for real use.

  def index
    # with_counts adds a `book.query_doc_pairs_count` field, which avoids loading
    # all query_doc_pairs and makes bullet happy.
    query = current_user.books_involved_with.includes([ :teams ]).with_counts

    # Filter by archived status
    archived = deserialize_bool_param(params[:archived])
    query = if archived
              query.archived
            else
              query.active
            end

    query = query.where(teams: { id: params[:team_id] }) if params[:team_id].present?

    if params[:q].present?

      # `includes([:teams])` alone won't JOIN teams for a raw SQL condition (only a
      # hash condition like `where(teams: {...})` makes Rails switch to eager_load),
      # so match on ids first - same pattern as ForUserScope and CasesController#index.
      matching_ids = Book.left_joins(:teams)
        .search_by(params[:q], 'books.name', 'teams.name')
        .reselect(:id).distinct
      query = query.where(id: matching_ids)
    end

    @pagy, @books = pagy(query)
  end

  def show
    # Turbo promotes judging completion to a full-page visit; retain its notice for that request.
    flash.keep if 'query_doc_pair_card' == turbo_frame_request_id

    @kraken_unleashed = flash[:kraken_unleashed]

    @count_of_anonymous_book_judgements = @book.judgements.where(user: nil).count

    @moar_judgements_needed = SelectionStrategy.moar_judgements_needed? @book

    @cases = @book.cases.includes(:owner)

    # ── RE coverage metrics ───────────────────────────────────────────────────
    # Wrapped in a transaction so the three counts see one consistent snapshot
    # even while this book is being actively judged.
    @total_pairs, @zero_judgement_count, @partial_count = ActiveRecord::Base.transaction do
      [
        @book.query_doc_pairs_within_rank_depth.count,
        SelectionStrategy.unjudged_pairs_count(@book),
        SelectionStrategy.partially_judged_pairs_count(@book)
      ]
    end
    @complete_count = @total_pairs - @zero_judgement_count - @partial_count
    @coverage_pct   = @total_pairs.positive? ? ((@complete_count.to_f / @total_pairs) * 100).round : 0

    # ── Per-judge activity: last 30 days sparkline + last judged timestamp ────
    @judge_activity = @book.judge_activity_rows
    mark_refinable! @judge_activity

    respond_with(@book)
  end

  # if this becomes richer, then move to it's own controller
  def export
  end

  def judge_overview
    # Personal progress
    @total_pairs = @book.query_doc_pairs_within_rank_depth.count
    @user_total_judgement_count = @book.judgements.where(user: current_user).count
    @user_judgement_count  = @book.judgements.where(user:              current_user,
                                                    query_doc_pair_id: @book.query_doc_pairs_within_rank_depth.select(:id)).count
    @user_progress_pct     = @total_pairs.positive? ? ((@user_judgement_count.to_f / @total_pairs) * 100).round : 0

    # Last judging timestamp for this user in this book
    @last_judged_at = @book.judgements.where(user: current_user).maximum(:updated_at)

    # Pairs still available for this user to judge: either no one has touched
    # them yet, or someone has but not this user (and it's under 3 total
    # judgements) - matches exactly what SelectionStrategy would still hand
    # this user via the "judge next" flow.
    @pairs_needing_judgment_by_user =
      SelectionStrategy.unjudged_pairs_count(@book) +
      SelectionStrategy.partially_judged_pairs_not_yet_judged_by_count(@book, current_user)

    # 30-day sparkline: judgements per day for this user in this book
    @sparkline_data = @book.judge_activity_for([ current_user.id ], days: 30).fetch(current_user.id, { sparkline: [] })[:sparkline]

    @user_has_judged_all = SelectionStrategy.user_has_judged_all_available_pairs?(@book, current_user)
    @moar_judgements_needed = SelectionStrategy.moar_judgements_needed?(@book)

    respond_with(@book)
  end

  # Polled by the judge-activity-poll Stimulus controller as a fallback for
  # BroadcastJudgeActivityJob's live Turbo Stream push - if that broadcast is
  # ever missed (a dropped ActionCable connection, a broadcast that fires
  # before the page's subscription is ready, etc.), a row could otherwise be
  # left showing as "actively judging" with nothing to correct it.
  #
  # Mirrors the broadcast job's own targets (status/count/last cells, never
  # the sparkline chart) for rows the poller says it already has, and only
  # falls back to appending a full row - chart included - for a judge id it
  # doesn't know about yet (a brand new row it's never rendered before).
  def judge_activity
    known_judge_ids = params[:known_judge_ids].to_s.split(',').to_set(&:to_i)
    rows = @book.judge_activity_rows
    mark_refinable! rows

    streams = rows.flat_map do |row|
      judge_id = row[:judge].id

      if known_judge_ids.include?(judge_id)
        [
          turbo_stream.replace("judge-status-#{judge_id}", partial: 'books/judge_status_cell', locals: { row: row, book: @book }),
          turbo_stream.replace("judge-count-#{judge_id}", partial: 'books/judge_count_cell', locals: { row: row }),
          turbo_stream.replace("judge-last-#{judge_id}", partial: 'books/judge_last_cell', locals: { row: row })
        ]
      else
        turbo_stream.append('judge-activity-table', partial: 'books/judge_activity_row', locals: { row: row, book: @book })
      end
    end

    current_ids = rows.to_set { |row| row[:judge].id }
    (known_judge_ids - current_ids).each do |judge_id|
      streams << turbo_stream.remove("judge-row-#{judge_id}")
    end
    streams << turbo_stream.remove('judge-activity-empty') if rows.any?
    if rows.empty?
      streams << turbo_stream.update('judge-activity-table', partial: 'books/judge_activity_table_body',
                                                             locals:  { judge_activity: [], book: @book })
    end
    render turbo_stream: streams
  end

  def judgement_stats
    @rating_distribution_data = rating_distribution_for @book

    @leaderboard_data = []
    @stats_data = []

    unique_judge_ids = @book.query_doc_pairs.joins(:judgements)
      .distinct.pluck(:user_id)

    assigned_ai_judges = @book.ai_judges.pluck(:user_id)
    @refinable_ai_judge_ids = accessible_ai_judges.pluck(:id)

    stats_judges_ids = (unique_judge_ids + assigned_ai_judges).uniq

    stats_judges = []
    stats_judges_ids.each do |judge_id|
      begin
        judge = User.find(judge_id) unless judge_id.nil?
      rescue ActiveRecord::RecordNotFound
        judge = nil
      end
      stats_judges << judge
    end

    stats_judges = compact_keep_one_nil(stats_judges)
    stats_judges = stats_judges.sort_by { |judge| judge.nil? ? '' : judge.fullname }

    stats_judges.each do |judge|
      @leaderboard_data << { judge:      judge.nil? ? 'anonymous' : judge.fullname,
                             judgements: @book.judgements.where(user: judge).count }
      @stats_data << {
        judge:       judge,
        judgements:  @book.judgements.where(user: judge).count,
        unrateable:  @book.judgements.where(user: judge).where(unrateable: true).count,
        judge_later: @book.judgements.where(user: judge).where(judge_later: true).count,
      }
    end

    respond_with(@book)
  end

  def new
    # we actually support passing in starting point configuration for a book
    @book = if params[:book]
              Book.new(book_params.except(:team_ids, :ai_judge_ids, :auto_run_ai_judge_ids))
            else
              Book.new
            end

    assign_book_memberships if params[:book]

    if params[:scorer_id]
      scorer = current_user.scorers_involved_with.find_by(id: params[:scorer_id])
      if scorer
        @book.scale = scorer.scale
        @book.scale_with_labels = scorer.scale_with_labels
        @book.scorer_id = matching_scorer_id_for_book(current_user, @book)
        @book.scoring_guidelines = @book.default_scoring_guidelines
      end
    end

    @ai_judges = accessible_ai_judges

    @origin_case = current_user.cases_involved_with.where(id: params[:origin_case_id]).first if params[:origin_case_id]

    if @origin_case
      @book.name = "Book for #{@origin_case.case_name}"
      @book.team_ids = @origin_case.team_ids & current_user.team_ids
    end

    respond_with(@book)
  end

  def edit
    @ai_judges = accessible_ai_judges

    @book.scorer_id = matching_scorer_id_for_book(current_user, @book)

    # Bullet really wants :rated_query_doc_pairs to be included, however that kills our performance!
    # In our use case just looks up the count of records per book.
    @other_books = current_user.books_involved_with.where.not(id: @book.id)

    judgement_ratings = @book.judgements.where.not(rating: nil).distinct.pluck(:rating)
    case_ratings = Rating.joins(query: :case).where(cases: { book_id: @book.id }).where.not(rating: nil).distinct.pluck(:rating)
    @current_ratings = (judgement_ratings + case_ratings).uniq.sort
  end

  def create
    @book = Book.new(book_params.except(:team_ids, :ai_judge_ids, :auto_run_ai_judge_ids))
    @book.owner = current_user
    assign_book_memberships

    # Handle scorer selection
    if book_params[:scorer_id].blank?
      @book.errors.add(:scorer_id, 'must be selected')
      @ai_judges = accessible_ai_judges
      render :new, status: :unprocessable_content
      return
    end

    apply_scorer_to_book(@book, book_params[:scorer_id])

    if @book.save
      @book.books_ai_judges.each(&:save!)

      if params[:book][:link_the_case]
        @origin_case = current_user.cases_involved_with.where(id: params[:book][:origin_case_id]).first
        @origin_case.book = @book
        @origin_case.auto_populate_book_pairs = deserialize_bool_param(
          params[:book][:auto_populate_book_pairs]
        )
        @origin_case.auto_populate_case_judgements = deserialize_bool_param(
          params[:book][:auto_populate_case_judgements]
        )
        @origin_case.save
      end

      redirect_to @book, notice: 'Book was successfully created.', status: :see_other
    else
      @ai_judges = accessible_ai_judges
      render :new, status: :unprocessable_content
    end
  end

  def update
    assign_book_memberships

    # Handle scorer selection
    apply_scorer_to_book(@book, book_params[:scorer_id]) if book_params[:scorer_id].present?

    @book.update(book_params.except(
                   :team_ids, :ai_judge_ids, :auto_run_ai_judge_ids, :link_the_case, :origin_case_id, :scorer_id,
                   :delete_export_file, :delete_import_file,
                   :auto_populate_book_pairs,
                   :auto_populate_case_judgements
                 ))

    @book.export_file.purge if '1' == book_params[:delete_export_file]
    @book.import_file.purge if '1' == book_params[:delete_import_file]

    @book.save

    @ai_judges = accessible_ai_judges
    @other_books = current_user.books_involved_with.where.not(id: @book.id)

    respond_with(@book)
  end

  def destroy
    @book.really_destroy
    redirect_to books_path, notice: 'Book is deleted', status: :see_other
  end

  def archive
    @book.update(archived: true)
    redirect_to books_path, notice: "Book '#{@book.name}' has been archived.", status: :see_other
  end

  def unarchive
    @book.update(archived: false)
    redirect_to books_path(archived: true), notice: "Book '#{@book.name}' has been unarchived.", status: :see_other
  end

  def combine
    book_ids = params[:book_ids].select { |_key, value| '1' == value }.keys.map(&:to_i)

    books_by_id = current_user.books_involved_with.where(id: book_ids).index_by(&:id)
    raise ActiveRecord::RecordNotFound unless books_by_id.size == book_ids.uniq.size

    # The order matters when several source books contain ratings for the same user.
    combiner = BookCombiner.new(@book, book_ids.map { |id| books_by_id.fetch(id) })
    query_doc_pair_count = combiner.combine

    UpdateCaseJob.perform_later @book
    redirect_to book_path(@book), :notice => "Combined #{query_doc_pair_count} query/doc pairs.", status: :see_other
  rescue BookCombiner::ScaleMismatch
    redirect_to book_path(@book),
                status: :see_other,
                :alert => "One of the books chosen doesn't have a scale matching #{@book.scale}"
  rescue ActiveRecord::RecordInvalid => e
    redirect_to book_path(@book),
                status: :see_other,
                :alert => "Could not merge due to errors: #{e.record.errors.full_messages.to_sentence}. #{combiner.query_doc_pair_count} query/doc pairs."
  end

  def run_judge_judy
    ai_judge = @book.ai_judges.where(id: params[:ai_judge_id]).first

    unless ai_judge
      redirect_to book_path(@book), alert: 'AI Judge not found.', status: :see_other
      return
    end

    judge_all = deserialize_bool_param(params[:judge_all])
    number_of_pairs = params[:number_of_pairs].to_i
    number_of_pairs = nil if judge_all

    RunJudgeJudyJob.perform_later(@book, ai_judge, number_of_pairs)
    redirect_to book_path(@book), flash: { kraken_unleashed: judge_all }, :notice => "AI Judge #{ai_judge.name} will start evaluating query/doc pairs.", status: :see_other
  end

  def cancel_judge_judy
    ai_judge = @book.ai_judges.where(id: params[:ai_judge_id]).first
    unless ai_judge
      redirect_to book_path(@book), alert: 'AI Judge not found.', status: :see_other
      return
    end

    RunJudgeJudyJob.cancel(@book, ai_judge)

    redirect_to book_path(@book), notice: "AI Judge #{ai_judge.name} has been cancelled.", status: :see_other
  end

  def assign_anonymous
    # assignee = @book.team.members.find_by(id: params[:assignee_id])
    assignee = User.find_by(id: params[:assignee_id])
    @book.judgements.where(user: nil).find_each do |judgement|
      judgement.user = assignee
      # if we are mapping a user to a judgement,
      # and they have already judged that query_doc_pair, then just delete it.
      if !judgement.valid? && (judgement.errors.added? :user_id, :taken, value: assignee.id)
        judgement.delete
      else
        judgement.save!
      end
    end

    UpdateCaseJob.perform_later @book
    redirect_to book_path(@book), :notice => "Assigned #{assignee.fullname} to ratings and judgements.", status: :see_other
  end

  def delete_ratings_by_assignee
    deleted_count = @book.judgements.where(user: @user).delete_all

    UpdateCaseJob.perform_later @book
    redirect_to book_path(@book), :notice => "Deleted #{deleted_count} judgements belonging to #{@user.fullname}.", status: :see_other
  end

  def reset_unrateable
    judgements_to_delete = @book.judgements.where(user: @user).where(unrateable: true)
    judgements_count = judgements_to_delete.count
    judgements_to_delete.destroy_all

    redirect_to book_path(@book),
                status: :see_other,
                :notice => "Reset unrateable status for #{judgements_count} judgements belonging to #{@user.fullname}."
  end

  def reset_judge_later
    judgements_to_delete = @book.judgements.where(user: @user).where(judge_later: true)
    judgements_count = judgements_to_delete.count
    judgements_to_delete.destroy_all

    redirect_to book_path(@book),
                status: :see_other,
                :notice => "Reset judge later status for #{judgements_count} judgements belonging to #{@user.fullname}."
  end

  def delete_query_doc_pairs_below_position
    position = params[:position]
    query_doc_pairs_to_delete = @book.query_doc_pairs.where('position > ?', position)
    query_doc_pairs_count = query_doc_pairs_to_delete.count
    query_doc_pairs_to_delete.destroy_all

    UpdateCaseJob.perform_later @book
    redirect_to book_path(@book),
                status: :see_other,
                :notice => "Deleted #{query_doc_pairs_count} query/doc pairs below position #{position}."
  end

  def eric_steered_us_wrong
    rating = params[:rating]
    judgements_to_update = @book.judgements.where(judge_later: true)
    judgements_to_update_count = judgements_to_update.count
    judgements_to_update.each do |judgement|
      judgement.judge_later = false
      judgement.rating = rating
      judgement.save
    end

    UpdateCaseJob.perform_later @book
    redirect_to book_path(@book),
                status: :see_other,
                :notice => "Mapped #{judgements_to_update_count} judgements to have rating #{rating}."
  end

  def remap_judgement_ratings
    changes = (params[:rating_map] || {}).to_unsafe_h.each_with_object({}) do |(old_rating, new_rating), acc|
      next if new_rating.blank? || old_rating.to_r == new_rating.to_r

      acc[old_rating.to_f] = new_rating.to_f
    end

    if changes.empty?
      redirect_to book_path(@book), notice: 'No ratings changed.', status: :see_other
      return
    end

    # Single UPDATE with a CASE expression — SQL evaluates all WHEN conditions against
    # the original value, so chained remappings (e.g. 5→4, 4→3) cannot double-update.
    # Values are already coerced to Float so interpolation is safe (no injection risk).
    # Both update_all calls below join through other tables, so the CASE expression
    # qualifies its column reference to avoid ambiguity - but the SET target itself
    # stays an unqualified "rating =", since SQLite's UPDATE ... FROM syntax rejects
    # a qualified assignment target (MySQL accepts either form).
    whens = changes.map { |old, new_val| "WHEN #{old} THEN #{new_val}" }.join(' ')
    case_sql = "CASE judgements.rating #{whens} ELSE judgements.rating END"

    # Wrapped in a transaction so judgements and case ratings remap together or not at all -
    # otherwise a failure between the two update_all calls would leave the book's ratings
    # partially remapped.
    judgements_updated = case_ratings_updated = 0
    ActiveRecord::Base.transaction do
      judgements_updated = @book.judgements.where(rating: changes.keys).update_all("rating = #{case_sql}")

      ratings_case_sql = "CASE ratings.rating #{whens} ELSE ratings.rating END"
      case_ratings_updated = Rating.joins(query: :case)
        .where(cases: { book_id: @book.id })
        .where(rating: changes.keys)
        .update_all("rating = #{ratings_case_sql}")
    end

    UpdateCaseJob.perform_later @book
    redirect_to book_path(@book),
                status: :see_other,
                :notice => "Remapped #{judgements_updated} judgements and #{case_ratings_updated} case ratings."
  end

  private

  # A judge that judged this book historically may since have been
  # unassigned, or belong to a teammate whose team doesn't share the judge
  # itself even though it shares this book - guard the "Refine Prompt" link
  # so it isn't shown for a judge the viewer can't actually open. Memoized:
  # #show and #judge_activity both need it for the same request.
  def refinable_ai_judge_ids
    @refinable_ai_judge_ids ||= AiJudge.for_user(current_user).pluck(:id)
  end

  # Stamps each judge_activity_rows row with whether *this* viewer can open
  # it, so _judge_status_cell just reads row[:refinable] instead of every
  # caller threading the id list through table_body/row partials that never
  # read it themselves.
  def mark_refinable! rows
    ids = refinable_ai_judge_ids
    rows.each { |row| row[:refinable] = ids.include?(row[:judge].id) }
  end

  def accessible_ai_judges
    AiJudge.for_user(current_user)
  end

  def assign_book_memberships
    available_judges = accessible_ai_judges
    judges = available_judges.find(Array(book_params[:ai_judge_ids]).compact_blank.uniq)
    hidden_judges = @book.ai_judges.where.not(id: available_judges.select(:id)).to_a
    TeamSharing.new(current_user).assign_teams(@book, book_params[:team_ids])
    selected = (hidden_judges + judges).uniq
    @book.ai_judges = selected
    return unless book_params.key?(:auto_run_ai_judge_ids)

    auto_ids = Array(book_params[:auto_run_ai_judge_ids]).compact_blank.map(&:to_i)
    @book.books_ai_judges.each do |assignment|
      next unless judges.any? { |judge| judge.id == assignment.user_id }

      assignment.auto_run = auto_ids.include?(assignment.user_id)
      assignment.save! if assignment.persisted?
    end
  end

  # This set_book is different because we use :id, not :book_id.
  def set_book
    @book = current_user.books_involved_with.where(id: params[:id]).first

    unless @book
      redirect_to books_path,
                  alert: "Could not retrieve book #{params[:id]}. Confirm that the book has been shared with you via a team you are a member of!"
      return
    end

    TrackBookViewedJob.perform_later current_user.id, @book.id
  end

  def find_user
    @user = User.find(params.expect(:user_id))
  end

  def compact_keep_one_nil array
    has_nil = array.count(nil).positive?
    array.compact!
    array << nil if has_nil
    array
  end

  # Counts rateable judgements per scale value, so the chart shows every
  # scale value (even ones with zero judgements) in the book's scale order.
  def rating_distribution_for book
    counts = book.judgements.rateable.group(:rating).count
    scale_values = book.scale.presence || counts.keys.compact.map(&:to_i).sort

    scale_values.map do |value|
      label = book.scale_with_labels && book.scale_with_labels[value.to_s]
      {
        rating: label.present? ? "#{value} - #{label}" : value.to_s,
        count:  counts[value.to_f].to_i,
      }
    end
  end

  def book_params
    params_to_use = params.expect(book: [ :scorer_id, :name,
                                          :support_implicit_judgements, :link_the_case, :origin_case_id,
                                          :auto_populate_book_pairs,
                                          :auto_populate_case_judgements,
                                          :delete_export_file, :delete_import_file,
                                          :show_rank, :scoring_guidelines, :rank_depth,
                                          { team_ids: [], ai_judge_ids: [], auto_run_ai_judge_ids: [] } ])

    # Use a top-level parameter because nested team_ids are not accepted here.
    params_to_use[:team_ids] = params[:team_ids] if params[:team_ids]
    params_to_use[:team_ids]&.compact_blank!

    params_to_use[:ai_judge_ids] = params[:ai_judge_ids] if params[:ai_judge_ids]
    params_to_use[:ai_judge_ids]&.compact_blank!

    params_to_use.except(:link_the_case, :origin_case_id,
                         :auto_populate_book_pairs,
                         :auto_populate_case_judgements)
  end
end
