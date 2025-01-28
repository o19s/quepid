# frozen_string_literal: true

# rubocop:disable Metrics/ClassLength
class BooksController < ApplicationController
  before_action :set_book,
                only: [ :show, :edit, :update, :destroy, :combine, :assign_anonymous, :delete_ratings_by_assignee,
                        :reset_unrateable, :reset_judge_later, :delete_query_doc_pairs_below_position,
                        :eric_steered_us_wrong, :run_judge_judy, :judgement_stats ]
  before_action :check_book,
                only: [ :show, :edit, :update, :destroy, :combine, :assign_anonymous, :delete_ratings_by_assignee,
                        :reset_unrateable, :reset_judge_later, :delete_query_doc_pairs_below_position,
                        :eric_steered_us_wrong, :run_judge_judy, :judgement_stats ]

  before_action :find_user, only: [ :reset_unrateable, :reset_judge_later, :delete_ratings_by_assignee ]

  respond_to :html

  def index
    @books = current_user.books_involved_with.includes([ :teams, :scorer, :selection_strategy ])
    respond_with(@books)
  end

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  def show
    @kraken_unleashed = flash[:kraken_unleashed]

    @count_of_anonymous_book_judgements = @book.judgements.where(user: nil).count

    # @moar_judgements_needed = @book.judgements.where(user: current_user).count < @book.query_doc_pairs.count
    @moar_judgements_needed = !(SelectionStrategy.every_query_doc_pair_has_three_judgements? @book)

    @cases = @book.cases

    respond_with(@book)
  end

  def judgement_stats
    @leaderboard_data = []
    @stats_data = []

    unique_judge_ids = @book.query_doc_pairs.joins(:judgements)
      .distinct.pluck(:user_id)

    @ai_judges = @book.ai_judges
    assigned_ai_judges = @ai_judges.pluck(:user_id)

    stats_judges = (unique_judge_ids + assigned_ai_judges).uniq

    stats_judges.each do |judge_id|
      begin
        judge = User.find(judge_id) unless judge_id.nil?
      rescue ActiveRecord::RecordNotFound
        judge = nil
      end
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

    @ai_judges = []

    @origin_case = current_user.cases_involved_with.where(id: params[:origin_case_id]).first if params[:origin_case_id]

    respond_with(@book)
  end

  def edit
    @ai_judges = User.only_ai_judges.left_joins(teams: :books).where(teams_books: { book_id: @book.id })
  end

  def create
    @book = Book.new(book_params)
    @book.owner = current_user
    if @book.save

      if params[:book][:link_the_case]
        @origin_case = current_user.cases_involved_with.where(id: params[:book][:origin_case_id]).first
        @origin_case.book = @book
        @origin_case.save
      end

      redirect_to @book, notice: 'Book was successfully created.'
    else
      render :new
    end
  end

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
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

    # checkboxes suck
    @book.ai_judges.clear
    book_params[:ai_judge_ids].each do |ai_judge_id|
      @book.ai_judges << User.find(ai_judge_id)
    end

    @book.update(book_params.except(
                   :team_ids, :ai_judges, :link_the_case, :origin_case_id,
                   :delete_export_file, :delete_populate_file, :delete_import_file
                 ))

    @book.export_file.purge if '1' == book_params[:delete_export_file]
    @book.populate_file.purge if '1' == book_params[:delete_populate_file]
    @book.import_file.purge if '1' == book_params[:delete_import_file]

    @book.save

    respond_with(@book)
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength

  def destroy
    @book.destroy
    respond_with(@book)
  end

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/PerceivedComplexity
  # rubocop:disable Layout/LineLength
  def combine
    book_ids = params[:book_ids].select { |_key, value| '1' == value }.keys.map(&:to_i)

    query_doc_pair_count = 0

    books = []
    book_ids.each do |book_id|
      book_to_merge = current_user.books_involved_with.where(id: book_id).first
      books << book_to_merge
    end

    if books.any? { |b| b.scorer.scale != @book.scorer.scale }
      redirect_to book_path(@book),
                  :alert => "One of the books chosen doesn't have a scorer with the scale #{@book.scorer.scale}" and return
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
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/PerceivedComplexity
  # rubocop:enable Layout/LineLength

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
    # @book.cases.each do |kase|
    #  kase.ratings.where(user: nil).find_each do |rating|
    #    rating.user = assignee
    #    rating.save!
    #  end
    # end

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

  private

  # This set_book is different because we use :id, not :book_id.
  def set_book
    @book = current_user.books_involved_with.where(id: params[:id]).first
    TrackBookViewedJob.perform_later current_user, @book
  end

  def find_user
    @user = User.find(params[:user_id])
  end

  def book_params
    params_to_use = params.expect(book: [ :scorer_id, :selection_strategy_id, :name,
                                          :support_implicit_judgements, :link_the_case, :origin_case_id,
                                          :delete_export_file, :delete_populate_file, :delete_import_file,
                                          :show_rank, { team_ids: [], ai_judge_ids: [] } ])

    # Crafting a book[team_ids] parameter from the AngularJS side didn't work, so using top level parameter
    params_to_use[:team_ids] = params[:team_ids] if params[:team_ids]
    params_to_use[:team_ids]&.compact_blank!

    params_to_use[:ai_judge_ids] = params[:ai_judge_ids] if params[:ai_judge_ids]
    params_to_use[:ai_judge_ids]&.compact_blank!

    params_to_use.except(:link_the_case, :origin_case_id)
  end
end

# rubocop:enable Metrics/ClassLength
