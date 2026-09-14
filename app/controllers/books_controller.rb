# frozen_string_literal: true

class BooksController < ApplicationController
  include Pagy::Method
  include BooksHelper

  before_action :set_book,
                only: [ :show, :edit, :update, :destroy, :combine, :assign_anonymous, :delete_ratings_by_assignee,
                        :reset_unrateable, :reset_judge_later, :delete_query_doc_pairs_below_position,
                        :eric_steered_us_wrong, :remap_judgement_ratings, :run_judge_judy, :cancel_judge_judy,
                        :judgement_stats, :judge_overview, :export, :archive, :unarchive ]
  before_action :check_book,
                only: [ :show, :edit, :update, :destroy, :combine, :assign_anonymous, :delete_ratings_by_assignee,
                        :reset_unrateable, :reset_judge_later, :delete_query_doc_pairs_below_position,
                        :eric_steered_us_wrong, :remap_judgement_ratings, :run_judge_judy, :cancel_judge_judy,
                        :judgement_stats, :judge_overview, :export, :archive, :unarchive ]

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
      q = "%#{params[:q].to_s.downcase}%"
      query = query.where('LOWER(books.name) LIKE ? OR LOWER(teams.name) LIKE ?', q, q)
    end

    @pagy, @books = pagy(query)
  end

  # rubocop:disable-next Metrics/AbcSize
  def show
    @kraken_unleashed = flash[:kraken_unleashed]

    @count_of_anonymous_book_judgements = @book.judgements.where(user: nil).count

    @moar_judgements_needed = SelectionStrategy.moar_judgements_needed? @book

    @cases = @book.cases

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

    # ── Per-judge activity: last 7 days sparkline + last judged timestamp ─────
    judge_ids = (@book.judgements.where.not(user_id: nil).distinct.pluck(:user_id) + @book.ai_judges.pluck(:id)).uniq

    @actively_judging_ids = RunJudgeJudyJob.actively_judging_user_ids(@book)
    judges_by_id = User.where(id: judge_ids).index_by(&:id)
    activity     = @book.judge_activity_for(judge_ids)
    auto_run_ids = @book.books_ai_judges.auto_run.pluck(:user_id)

    @judge_activity = judge_ids.filter_map do |uid|
      judge = judges_by_id[uid]
      next unless judge

      stats = activity.fetch(uid, { sparkline: [], count: 0, last_judged_at: nil })
      { judge: judge, sparkline: stats[:sparkline], last_judged_at: stats[:last_judged_at],
        count: stats[:count], actively_judging: @actively_judging_ids.include?(judge.id),
        auto_run: auto_run_ids.include?(judge.id) }
    end
    @judge_activity = @judge_activity.sort_by { |j| j[:judge].fullname }

    respond_with(@book)
  end

  # if this becomes richer, then move to it's own controller
  def export
  end

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  def judge_overview
    # Personal progress
    @total_pairs           = @book.query_doc_pairs_within_rank_depth.count
    @user_judgement_count  = @book.judgements.where(user: current_user).count
    @user_progress_pct     = @total_pairs.positive? ? ((@user_judgement_count.to_f / @total_pairs) * 100).round : 0

    # Last judging timestamp for this user in this book
    @last_judged_at = @book.judgements.where(user: current_user).maximum(:updated_at)

    # Pairs with zero judgements total (highest priority — no one has touched them)
    @zero_judgement_pairs_count = SelectionStrategy.unjudged_pairs_count(@book)

    # Pairs with 1-2 judgements total that the current user has NOT judged yet
    @needs_more_not_yet_judged_by_user =
      SelectionStrategy.partially_judged_pairs_not_yet_judged_by_count(@book, current_user)

    # 7-day sparkline: judgements per day for this user in this book
    @sparkline_data = @book.judge_activity_for([ current_user.id ]).fetch(current_user.id, { sparkline: [] })[:sparkline]

    @user_has_judged_all = SelectionStrategy.user_has_judged_all_available_pairs?(@book, current_user)
    @moar_judgements_needed = SelectionStrategy.moar_judgements_needed?(@book)

    respond_with(@book)
  end

  def judgement_stats
    @moar_judgements_needed = SelectionStrategy.moar_judgements_needed? @book

    @rating_distribution_data = rating_distribution_for @book

    @leaderboard_data = []
    @stats_data = []

    unique_judge_ids = @book.query_doc_pairs.joins(:judgements)
      .distinct.pluck(:user_id)

    @ai_judges = @book.ai_judges
    assigned_ai_judges = @ai_judges.pluck(:user_id)

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
        judge:          judge,
        judgements:     @book.judgements.where(user: judge).count,
        unrateable:     @book.judgements.where(user: judge).where(unrateable: true).count,
        judge_later:    @book.judgements.where(user: judge).where(judge_later: true).count,
        can_judge_more: @book.judgements.where(user: judge).count < @book.query_doc_pairs.count,
      }
    end

    respond_with(@book)
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength

  def new
    # we actually support passing in starting point configuration for a book
    @book = if params[:book]
              Book.new(book_params)
            else
              Book.new
            end

    if params[:scorer_id]
      scorer = current_user.scorers_involved_with.find_by(id: params[:scorer_id])
      if scorer
        @book.scale = scorer.scale
        @book.scale_with_labels = scorer.scale_with_labels
        @book.scorer_id = scorer.id
        @book.scoring_guidelines = @book.default_scoring_guidelines
      end
    end

    @ai_judges = []

    @origin_case = current_user.cases_involved_with.where(id: params[:origin_case_id]).first if params[:origin_case_id]

    if @origin_case
      @book.name = "Book for #{@origin_case.case_name}"
      @book.team_ids = @origin_case.team_ids & current_user.team_ids
    end

    respond_with(@book)
  end

  def edit
    @ai_judges = User.only_ai_judges.left_joins(teams: :books).where(teams_books: { book_id: @book.id })

    @book.scorer_id = matching_scorer_id_for_book(current_user, @book)

    # Bullet really wants :rated_query_doc_pairs to be included, however that kills our performance!
    # In our use case just looks up the count of records per book.
    @other_books = current_user.books_involved_with.where.not(id: @book.id)

    judgement_ratings = @book.judgements.where.not(rating: nil).distinct.pluck(:rating)
    case_ratings = Rating.joins(query: :case).where(cases: { book_id: @book.id }).where.not(rating: nil).distinct.pluck(:rating)
    @current_ratings = (judgement_ratings + case_ratings).uniq.sort
  end

  def create
    @book = Book.new(book_params.except(:auto_run_ai_judge_ids))
    @book.owner = current_user

    # Handle scorer selection
    apply_scorer_to_book(@book, book_params[:scorer_id]) if book_params[:scorer_id].present?

    if @book.save

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

      redirect_to @book, notice: 'Book was successfully created.'
    else
      render :new
    end
  end

  # rubocop:disable Metrics/AbcSize
  def update
    # this logic is crazy, but basically we don't want to touch the teams that are associated with
    # an book that the current_user CAN NOT see, so we clear out of the relationship all the ones
    # they can see, and then repopulate it from the list of ids checked.  Checkboxes suck.
    team_ids_belonging_to_user = current_user.teams.pluck(:id)
    teams = @book.teams.reject { |t| team_ids_belonging_to_user.include?(t.id) }
    @book.teams.clear
    book_params[:team_ids].each do |team_id|
      teams << Team.find(team_id)
    end

    @book.teams.replace(teams)

    # checkboxes suck, but we diff (rather than clear-and-recreate) so an
    # unrelated book save doesn't reset every judge's auto_run flag back to
    # false.
    # Array() guards against a non-standard caller (API client, curl) omitting
    # the key entirely - the standard form always submits both as arrays via
    # hidden fields, but nothing at the request layer guarantees that.
    ai_judge_ids = Array(book_params[:ai_judge_ids]).compact_blank.map(&:to_i)
    auto_run_ai_judge_ids = Array(book_params[:auto_run_ai_judge_ids]).compact_blank.map(&:to_i)

    @book.books_ai_judges.where.not(user_id: ai_judge_ids).destroy_all
    ai_judge_ids.each do |ai_judge_id|
      books_ai_judge = @book.books_ai_judges.find_or_initialize_by(user_id: ai_judge_id)
      books_ai_judge.auto_run = auto_run_ai_judge_ids.include?(ai_judge_id)
      books_ai_judge.save
    end

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

    @ai_judges = User.only_ai_judges.left_joins(teams: :books).where(teams_books: { book_id: @book.id })
    @other_books = current_user.books_involved_with.where.not(id: @book.id)

    respond_with(@book)
  end

  # rubocop:enable Metrics/AbcSize
  def destroy
    @book.really_destroy
    redirect_to books_path, notice: 'Book is deleted'
  end

  def archive
    @book.update(archived: true)
    redirect_to books_path, notice: "Book '#{@book.name}' has been archived."
  end

  def unarchive
    @book.update(archived: false)
    redirect_to books_path(archived: true), notice: "Book '#{@book.name}' has been unarchived."
  end

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/PerceivedComplexity
  def combine
    book_ids = params[:book_ids].select { |_key, value| '1' == value }.keys.map(&:to_i)

    query_doc_pair_count = 0

    books = []
    book_ids.each do |book_id|
      book_to_merge = current_user.books_involved_with.where(id: book_id).first
      books << book_to_merge
    end

    if books.any? { |b| b.scale != @book.scale }
      redirect_to book_path(@book),
                  :alert => "One of the books chosen doesn't have a scale matching #{@book.scale}" and return
    end

    books.each do |book_to_merge|
      book_to_merge.query_doc_pairs.each do |qdp|
        query_doc_pair = @book.query_doc_pairs.find_or_create_by query_text: qdp.query_text,
                                                                 doc_id:     qdp.doc_id

        # copy over the document fields if our source is newer than our target.
        # if qdp.updated_at > query_doc_pair.updated_at or query_doc_pair.document_fields.blank?
        query_doc_pair.document_fields = qdp.document_fields
        # end

        # copy over the position if our source has a position and our target doesn't.
        query_doc_pair.position = qdp.position if query_doc_pair.position.nil? && !qdp.position.nil?

        qdp.judgements.includes([ :user ]).rateable.each do |j|
          judgement = query_doc_pair.judgements.find_or_initialize_by(user: j.user)

          judgement.rating = if judgement.rating
                               (judgement.rating + j.rating) / 2
                             else
                               j.rating
                             end

          judgement.rating = judgement.rating.round unless @book.support_implicit_judgements

          judgement.save
        end
        query_doc_pair_count += 1

        # This .save seems required though I don't know why.'
        query_doc_pair.save
      end
    end

    if @book.save
      UpdateCaseJob.perform_later @book
      redirect_to book_path(@book), :notice => "Combined #{query_doc_pair_count} query/doc pairs."
    else
      redirect_to book_path(@book),
                  :alert => "Could not merge due to errors: #{@book.errors.full_messages.to_sentence}. #{query_doc_pair_count} query/doc pairs."
    end
  end

  def run_judge_judy
    ai_judge = @book.ai_judges.where(id: params[:ai_judge_id]).first

    judge_all = deserialize_bool_param(params[:judge_all])
    number_of_pairs = params[:number_of_pairs].to_i
    number_of_pairs = nil if judge_all

    RunJudgeJudyJob.perform_later(@book, ai_judge, number_of_pairs)
    redirect_to book_path(@book), flash: { kraken_unleashed: judge_all }, :notice => "AI Judge #{ai_judge.name} will start evaluating query/doc pairs."
  end

  def cancel_judge_judy
    ai_judge = @book.ai_judges.where(id: params[:ai_judge_id]).first
    unless ai_judge
      redirect_to book_path(@book), alert: 'AI Judge not found.'
      return
    end

    RunJudgeJudyJob.active_for(@book, ai_judge).each do |job|
      if job.claimed_execution.present?
        # Job is actively running — force destroy it. RunJudgeJudyJob#perform
        # checks for its own SolidQueue row on every iteration and stops as
        # soon as it notices this row is gone.
        job.claimed_execution.destroy
        job.destroy
      else
        job.discard
      end
    end

    redirect_to book_path(@book), notice: "AI Judge #{ai_judge.name} has been cancelled."
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/PerceivedComplexity

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
    redirect_to book_path(@book), :notice => "Assigned #{assignee.fullname} to ratings and judgements."
  end

  def delete_ratings_by_assignee
    deleted_count = @book.judgements.where(user: @user).delete_all

    UpdateCaseJob.perform_later @book
    redirect_to book_path(@book), :notice => "Deleted #{deleted_count} judgements belonging to #{@user.fullname}."
  end

  def reset_unrateable
    judgements_to_delete = @book.judgements.where(user: @user).where(unrateable: true)
    judgements_count = judgements_to_delete.count
    judgements_to_delete.destroy_all

    redirect_to book_path(@book),
                :notice => "Reset unrateable status for #{judgements_count} judgements belonging to #{@user.fullname}."
  end

  def reset_judge_later
    judgements_to_delete = @book.judgements.where(user: @user).where(judge_later: true)
    judgements_count = judgements_to_delete.count
    judgements_to_delete.destroy_all

    redirect_to book_path(@book),
                :notice => "Reset judge later status for #{judgements_count} judgements belonging to #{@user.fullname}."
  end

  def delete_query_doc_pairs_below_position
    position = params[:position]
    query_doc_pairs_to_delete = @book.query_doc_pairs.where('position > ?', position)
    query_doc_pairs_count = query_doc_pairs_to_delete.count
    query_doc_pairs_to_delete.destroy_all

    UpdateCaseJob.perform_later @book
    redirect_to book_path(@book),
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
                :notice => "Mapped #{judgements_to_update_count} judgements to have rating #{rating}."
  end

  def remap_judgement_ratings
    changes = (params[:rating_map] || {}).to_unsafe_h.each_with_object({}) do |(old_rating, new_rating), acc|
      next if new_rating.blank? || old_rating.to_r == new_rating.to_r

      acc[old_rating.to_f] = new_rating.to_f
    end

    if changes.empty?
      redirect_to book_path(@book), notice: 'No ratings changed.'
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
                :notice => "Remapped #{judgements_updated} judgements and #{case_ratings_updated} case ratings."
  end

  private

  def apply_scorer_to_book book, scorer_id
    scorer = current_user.scorers_involved_with.find_by(id: scorer_id)
    if scorer
      book.scale = scorer.scale
      book.scale_with_labels = scorer.scale_with_labels
    end
  end

  # This set_book is different because we use :id, not :book_id.
  def set_book
    @book = current_user.books_involved_with.where(id: params[:id]).first
    TrackBookViewedJob.perform_later current_user, @book
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

    # Crafting a book[team_ids] parameter from the AngularJS side didn't work, so using top level parameter
    params_to_use[:team_ids] = params[:team_ids] if params[:team_ids]
    params_to_use[:team_ids]&.compact_blank!

    params_to_use[:ai_judge_ids] = params[:ai_judge_ids] if params[:ai_judge_ids]
    params_to_use[:ai_judge_ids]&.compact_blank!

    params_to_use[:auto_run_ai_judge_ids] = params[:auto_run_ai_judge_ids] if params[:auto_run_ai_judge_ids]
    params_to_use[:auto_run_ai_judge_ids]&.compact_blank!

    params_to_use.except(:link_the_case, :origin_case_id,
                         :auto_populate_book_pairs,
                         :auto_populate_case_judgements)
  end
end
