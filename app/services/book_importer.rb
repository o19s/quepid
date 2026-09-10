# frozen_string_literal: true

require 'progress_indicator'

class BookImporter
  # include ProgressIndicator

  attr_reader :logger, :options

  def initialize book, current_user, data_to_process, opts = {}
    default_options = {
      logger:             Rails.logger,
      show_progress:      false,
      force_create_users: false,
    }

    @options = default_options.merge(opts.deep_symbolize_keys)

    @book = book
    @current_user = current_user
    @data_to_process = data_to_process
    @logger = @options[:logger]
  end

  def validate
    params_to_use = @data_to_process

    @book.scale = params_to_use[:scale] if params_to_use.key?(:scale)
    @book.scale_with_labels = params_to_use[:scale_with_labels] if params_to_use[:scale_with_labels].present?

    emails_of_judges(params_to_use).each do |email|
      unless User.exists?(email: email)
        if true == options[:force_create_users]
          User.invite!({ email: email, password: '', skip_invitation: true }, @current_user)
        else
          @book.errors.add(:base, "User with email '#{email}' needs to be migrated over first.")
        end
      end
    end
  end

  # Returns true on success, so Api::V1::Import::BooksController#create's `if book_importer.import`
  # check doesn't depend on which of the branches below happened to run last (some callers - e.g.
  # a payload with only query_doc_pairs and no all_judgements - would otherwise see a falsy nil).
  # rubocop:disable Naming/PredicateMethod
  def import
    params_to_use = @data_to_process

    apply_top_level_attributes(params_to_use)
    apply_scale(params_to_use)

    # A freshly-imported book has no owner yet - force it to be owned by the user doing the
    # importing, otherwise you can lose the book! An existing book being added to keeps its owner.
    @book.owner = User.find_by(email: @current_user.email) if @book.new_record?

    @book.save

    import_query_doc_pairs(params_to_use[:query_doc_pairs]) if params_to_use[:query_doc_pairs]
    import_all_judgements(params_to_use[:all_judgements]) if params_to_use[:all_judgements]

    true
  end
  # rubocop:enable Naming/PredicateMethod

  private

  def apply_top_level_attributes params_to_use
    @book.name = params_to_use[:name] if params_to_use.key?(:name)
    @book.show_rank = params_to_use[:show_rank] if params_to_use.key?(:show_rank)
    return unless params_to_use.key?(:support_implicit_judgements)

    @book.support_implicit_judgements = params_to_use[:support_implicit_judgements]
  end

  # Set scale information (already set in #validate, but ensure it's persisted)
  def apply_scale params_to_use
    if params_to_use[:scorer]
      scorer_data = params_to_use[:scorer]
      @book.scale = scorer_data[:scale] if scorer_data[:scale].present?
      @book.scale_with_labels = scorer_data[:scale_with_labels] if scorer_data[:scale_with_labels].present?
    elsif params_to_use[:scale]
      @book.scale = params_to_use[:scale]
      @book.scale_with_labels = params_to_use[:scale_with_labels] if params_to_use[:scale_with_labels].present?
    end
  end

  def emails_of_judges params_to_use
    emails = []

    params_to_use[:query_doc_pairs]&.each do |query_doc_pair|
      query_doc_pair[:judgements]&.each do |judgement|
        emails << judgement[:user_email] if judgement[:user_email].present?
      end
    end

    params_to_use[:all_judgements]&.each do |judgement|
      email = judgement[:user_email] || judgement[:email]
      emails << email if email.present?
    end

    emails.uniq
  end

  def import_query_doc_pairs query_doc_pairs
    total = query_doc_pairs.size
    counter = total
    last_percent = 0

    query_doc_pairs.each do |query_doc_pair|
      qdp = find_or_initialize_query_doc_pair(query_doc_pair)
      qdp.assign_attributes(query_doc_pair.except(:judgements, :query_doc_pair_id))
      qdp.save

      counter -= 1
      last_percent = broadcast_progress(total, counter, last_percent, qdp)

      next unless query_doc_pair[:judgements]

      query_doc_pair[:judgements].each { |judgement| import_judgement(qdp, judgement) }
    end
  end

  # Emits a notifications broadcast every percent of `total` crossed, from 0 to 100,
  # and returns the (possibly updated) last_percent for the caller to carry forward.
  def broadcast_progress total, counter, last_percent, qdp
    percent = (((total - counter).to_f / total) * 100).truncate
    return last_percent unless percent > last_percent

    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'books/blah',
      locals:  { book: @book, counter: counter, percent: percent, qdp: qdp }
    )
    percent
  end

  def import_all_judgements judgements
    judgements.each do |judgement|
      qdp = if judgement[:query_doc_pair].present?
              upsert_nested_query_doc_pair(judgement[:query_doc_pair])
            else
              find_query_doc_pair(judgement)
            end

      next unless qdp

      import_judgement(qdp, judgement.except(:query_doc_pair, :query_doc_pair_id))
    end
  end

  def upsert_nested_query_doc_pair attrs
    qdp = find_or_initialize_query_doc_pair(attrs)
    qdp.assign_attributes(attrs.except(:query_doc_pair_id))
    qdp.save
    qdp
  end

  def find_query_doc_pair attrs
    return nil if attrs[:query_doc_pair_id].blank?

    @book.query_doc_pairs.find_by(id: attrs[:query_doc_pair_id])
  end

  def find_or_initialize_query_doc_pair attrs
    if attrs[:query_doc_pair_id].present?
      existing = @book.query_doc_pairs.find_by(id: attrs[:query_doc_pair_id])
      return existing if existing
    end

    # No id given, or it doesn't belong to this book (e.g. a stale/foreign id) - fall back to
    # matching by query_text/doc_id rather than forcing that id onto a new record, which would
    # collide with an unrelated row's primary key.
    @book.query_doc_pairs.find_or_initialize_by(query_text: attrs[:query_text], doc_id: attrs[:doc_id])
  end

  def import_judgement query_doc_pair, attrs
    user = User.find_by(id: attrs[:user_id]) || User.find_by(email: attrs[:user_email] || attrs[:email])

    judgement = query_doc_pair.judgements.find_or_initialize_by(user: user)
    judgement.assign_attributes(attrs.except(:user_email, :email, :user_id))
    judgement.save
  end
end
