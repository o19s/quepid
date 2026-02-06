# frozen_string_literal: true

class CaseImporter
  attr_reader :logger, :options

  def initialize acase, current_user, data_to_process, opts = {}
    default_options = {
      logger:             Rails.logger,
      show_progress:      false,
      force_create_users: false,
    }

    @options = default_options.merge(opts.deep_symbolize_keys)

    @case = acase
    @current_user = current_user
    @data_to_process = data_to_process
    @logger = @options[:logger]
  end

  def validate
    list_of_emails_of_users = []
    params_to_use = @data_to_process

    scorer_name = params_to_use[:scorer][:name]
    @case.errors.add(:scorer, "Scorer with name '#{scorer_name}' needs to be migrated over first.") unless Scorer.exists?(name: scorer_name)

    params_to_use[:queries]&.each do |query|
      next unless query[:ratings]

      query[:ratings].each do |rating|
        list_of_emails_of_users << rating[:user_email] if rating[:user_email].present?
      end
    end

    list_of_emails_of_users.uniq.each do |email|
      unless User.exists?(email: email)
        if options[:force_create_users]
          User.invite!({ email: email, password: '', skip_invitation: true }, @current_user)
        else
          @case.errors.add(:base, "User with email '#{email}' needs to be migrated over first.")
        end
      end
    end
  end

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  def import
    params_to_use = @data_to_process

    @case.case_name = params_to_use[:case_name]
    @case.options = params_to_use[:options]
    @case.public = params_to_use[:public]
    @case.archived = params_to_use[:archived]

    scorer_name = params_to_use[:scorer][:name]
    @case.scorer = Scorer.find_by(name: scorer_name)

    # Force the imported case to be owned by the user doing the importing.  Otherwise you can loose the case!
    @case.owner = User.find_by(email: @current_user.email)

    # For some reason we can't do @case.queries.build with out forcing a save.
    # Works fine with book however.
    unless @case.save
      render json: @case.errors, status: :bad_request
      return
    end

    params_to_use[:queries]&.each do |query|
      new_query = @case.queries.build(query.except(:ratings))
      next unless query[:ratings]

      query[:ratings].each do |rating|
        rating[:user] = User.find_by(email: rating[:user_email]) if rating[:user_email].present?
        new_query.ratings.build(rating.except(:user_email))
      end
    end

    # find_or_create_by wasn't working, so just doing it in two steps
    search_endpoint = @current_user.search_endpoints_involved_with.find_by(
      params_to_use[:try][:search_endpoint]
    )
    if search_endpoint.nil?
      search_endpoint = SearchEndpoint.new(params_to_use[:try][:search_endpoint])
      search_endpoint.owner = @current_user
      search_endpoint.save!
    end

    params_to_use[:try][:search_endpoint_id] = search_endpoint.id
    params_to_use[:try][:try_number] = 1

    @case.tries.first.update(params_to_use[:try].except(:curator_variables, :search_endpoint, :id))

    params_to_use[:try][:curator_variables]&.each do |curator_variable|
      # not sure why curator_variables.build and then the @case.save doesn't cascade down.
      @case.tries.first.curator_variables.create curator_variable
    end

    @case.save
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/AbcSize
end
