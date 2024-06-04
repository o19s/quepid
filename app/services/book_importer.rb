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

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/PerceivedComplexity
  def validate
    params_to_use = @data_to_process
    scorer_name = params_to_use[:scorer][:name]
    scorer = Scorer.find_by(name: scorer_name)
    if scorer.nil?
      @book.errors.add(:scorer, "with name '#{scorer_name}' needs to be migrated over first.")
    else
      @book.scorer = scorer
    end

    selection_strategy_name = params_to_use[:selection_strategy][:name]
    selection_strategy = SelectionStrategy.find_by(name: selection_strategy_name)
    if selection_strategy.nil?
      @book.errors.add(:selection_strategy,
                       "Selection strategy with name '#{selection_strategy_name}' needs to be migrated over first.")
    else
      @book.selection_strategy = selection_strategy
    end

    if params_to_use[:query_doc_pairs]
      list_of_emails_of_users = []
      params_to_use[:query_doc_pairs].each do |query_doc_pair|
        next unless query_doc_pair[:judgements]

        query_doc_pair[:judgements].each do |judgement|
          list_of_emails_of_users << judgement[:user_email] if judgement[:user_email].present?
        end
      end
      list_of_emails_of_users.uniq!
      list_of_emails_of_users.each do |email|
        unless User.exists?(email: email)
          if options[:force_create_users]
            User.invite!({ email: email, password: '', skip_invitation: true }, @current_user)
          else
            @book.errors.add(:base, "User with email '#{email}' needs to be migrated over first.")
          end
        end
      end
    end
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/PerceivedComplexity

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  def import
    params_to_use = @data_to_process

    # passed first set of validations.
    @book.name = params_to_use[:name]
    @book.show_rank = params_to_use[:show_rank]
    @book.support_implicit_judgements = params_to_use[:support_implicit_judgements]

    scorer_name = params_to_use[:scorer][:name]
    selection_strategy_name = params_to_use[:selection_strategy][:name]
    @book.scorer = Scorer.find_by(name: scorer_name)
    @book.selection_strategy = SelectionStrategy.find_by(name: selection_strategy_name)

    # Force the imported book to be owned by the user doing the importing.  Otherwise you can loose the book!
    @book.owner = User.find_by(email: @current_user.email)

    if params_to_use[:query_doc_pairs]
      counter = params_to_use[:query_doc_pairs].size
      params_to_use[:query_doc_pairs].each do |query_doc_pair|
        qdp = @book.query_doc_pairs.build(query_doc_pair.except(:judgements))
        counter -= 1
        Turbo::StreamsChannel.broadcast_render_to(
          :notifications,
          target:  'notifications',
          partial: 'books/blah',
          locals:  { book: @book, counter: counter, qdp: qdp }
        )
        next unless query_doc_pair[:judgements]

        query_doc_pair[:judgements].each do |judgement|
          judgement[:user] = User.find_by(email: judgement[:user_email])
          qdp.judgements.build(judgement.except(:user_email))
        end
      end
    end

    @book.save
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/AbcSize
end
