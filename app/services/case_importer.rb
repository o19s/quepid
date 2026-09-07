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
      unless User.by_email(email).exists?
        if options[:force_create_users]
          User.invite!({ email: email, password: '', skip_invitation: true }, @current_user)
        else
          @case.errors.add(:base, "User with email '#{email}' needs to be migrated over first.")
        end
      end
    end
  end

  def import
    import_succeeded = false

    ActiveRecord::Base.transaction do
      assign_case_attributes
      # For some reason we can't do @case.queries.build with out forcing a save.
      # Works fine with book however.
      raise ActiveRecord::Rollback unless @case.save

      build_queries_and_ratings
      attach_search_endpoint
      update_first_try

      import_succeeded = @case.save
      raise ActiveRecord::Rollback unless import_succeeded
    end

    import_succeeded
  end

  private

  def assign_case_attributes
    params = @data_to_process
    @case.case_name = params[:case_name]
    @case.options = params[:options]
    @case.public = params[:public]
    @case.archived = params[:archived]
    @case.scorer = Scorer.find_by(name: params[:scorer][:name])
    # Force the imported case to be owned by the user doing the importing.  Otherwise you can loose the case!
    @case.owner = User.find_by(email: @current_user.email)
  end

  def build_queries_and_ratings
    @data_to_process[:queries]&.each do |query|
      new_query = @case.queries.build(query.except(:ratings))
      next unless query[:ratings]

      query[:ratings].each do |rating|
        rating[:user] = User.by_email(rating[:user_email]).first if rating[:user_email].present?
        new_query.ratings.build(rating.except(:user_email))
      end
    end
  end

  def attach_search_endpoint
    search_endpoint = SearchEndpoint.find_or_initialize_for_user(
      @current_user,
      @data_to_process[:try][:search_endpoint]
    )
    if search_endpoint.new_record? && !search_endpoint.save
      search_endpoint.errors.messages.each do |attribute, messages|
        messages.each { |message| @case.errors.add(attribute, message) }
      end
      raise ActiveRecord::Rollback
    end

    @data_to_process[:try][:search_endpoint_id] = search_endpoint.id
  end

  def update_first_try
    try_params = @data_to_process[:try]
    try_params[:try_number] = 1
    @case.tries.first.update(try_params.except(:curator_variables, :search_endpoint, :id))

    try_params[:curator_variables]&.each do |curator_variable|
      # not sure why curator_variables.build and then the @case.save doesn't cascade down.
      @case.tries.first.curator_variables.create curator_variable
    end
  end
end
