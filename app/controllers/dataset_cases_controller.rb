# frozen_string_literal: true

# The cases a user has made from the example datasets, and making a new one.
class DatasetCasesController < ApplicationController
  class ScorerRefused < StandardError; end
  class SampleRefused < StandardError; end

  # With ?dataset=key (the Datasets tab's Load to case) the create dialog opens on that dataset.
  def index
    CaseToDataset.drop_orphans_of(current_user)
    load_cases
    load_dialogs
  end

  # Makes the case at once and has a background job fill it in with the dataset's queries.
  def create
    dataset = DatasetCatalog.find(params.fetch(:dataset, nil))
    return redirect_to(dataset_cases_path, alert: 'Pick a dataset that is available.', status: :see_other) unless dataset&.available
    return redirect_to(dataset_cases_path, alert: "Upload the #{dataset.name} files on the Datasets tab first.", status: :see_other) unless dataset.loadable?

    sample = sample_size(dataset)
    case_name = params[:case_name].presence || default_name(dataset, sample)
    scorer = chosen_scorer(dataset)
    link = CaseToDataset.start!(owner: current_user, dataset_key: dataset.key, case_name: case_name, scorer: scorer, sample_size: sample)
    LoadDatasetCaseJob.perform_later(link, case_name, scorer, sample)
    redirect_to dataset_cases_path, notice: "Creating #{case_name}: its queries from #{dataset.name} are loading in the background."
  rescue ScorerRefused, SampleRefused => e
    redirect_to dataset_cases_path, alert: e.message
  rescue DatasetScorer::Error, ActiveRecord::RecordInvalid => e
    redirect_to dataset_cases_path, alert: "Could not create the case from #{dataset.name}: #{e.message}"
  end

  # Uninstalls a dataset case: deletes the case, with its queries and ratings, and its link to the dataset. The
  # book the dataset came with, and any scorers, are left alone: they may be in use elsewhere.
  def destroy
    link = CaseToDataset.joins(:dataset).where(datasets: { owner_id: current_user.id }).find(params.expect(:id))
    kase = link.case
    return redirect_to(dataset_cases_path, alert: "#{kase.case_name} is still loading: uninstall it when that has finished.", status: :see_other) if link.in_progress?
    return redirect_to(dataset_cases_path, alert: "#{kase.case_name} belongs to someone else, so it cannot be uninstalled from here.", status: :see_other) unless kase.owner_id == current_user.id

    case_name = kase.case_name
    kase.really_destroy
    Analytics::Tracker.track_case_deleted_event(current_user, kase)
    link.destroy
    redirect_to dataset_cases_path, notice: "Uninstalled #{case_name}: the case was deleted."
  end

  private

  # The table: the user's live cases made from datasets, with what each row shows.
  def load_cases
    links = CaseToDataset.joins(:dataset, :case).where(datasets: { owner_id: current_user.id }, cases: { archived: [ false, nil ] })
      .includes(case: :scorer, dataset: []).order(created_at: :desc)
    @links = links.to_a
    case_ids = @links.map(&:case_id)
    @query_counts = Query.where(case_id: case_ids).group(:case_id).count
    @document_counts = CaseToDataset.document_counts(case_ids)
    # The search endpoint a case uses is its latest try's.
    @endpoints = Try.where(case_id: case_ids).includes(:search_endpoint).order(try_number: :desc).group_by(&:case_id)
      .transform_values { |tries| tries.first.search_endpoint }
  end

  # What the two dialogs need: Create new (datasets and scorers) and Initiate indexing (search endpoints).
  def load_dialogs
    @datasets = DatasetCatalog.loadable_first.select(&:loadable?)
    @open_dataset = @datasets.find { |dataset| dataset.key == params.fetch(:dataset, nil) }
    @scorers = current_user.scorers_involved_with.order(:name)
    @default_scorer = current_user.default_scorer || Scorer.system_default_scorer
    records = Dataset.where(owner: current_user).includes(:scorer).index_by(&:key)
    # The scorer the user built for each dataset with labels, if any (the dialog offers to create it otherwise).
    @dataset_scorers = records.transform_values(&:scorer)
    @search_endpoints = current_user.search_endpoints_involved_with.not_archived.order(:name)
  end

  # The number of queries to load instead of all, or nil for all (also when the sample is as big as the dataset).
  def sample_size dataset
    return if params[:sample_size].blank?

    size = Integer(params[:sample_size].to_s.strip, 10, exception: false)
    raise SampleRefused, 'The sample size must be a whole number of at least 1.' if size.nil? || size < 1
    raise SampleRefused, "#{dataset.name} cannot be sampled." unless dataset.sampleable?

    size < dataset.query_total ? size : nil
  end

  def default_name dataset, sample
    sample ? "#{dataset.default_case_name} (sample of #{sample})" : dataset.default_case_name
  end

  # The scorer picked in the form: 'new' for one built from the dataset's labels, or one the user can see
  # whose scale covers them. Blank means the user's default, which has to cover them too.
  def chosen_scorer dataset
    return DatasetScorer.new(current_user).find_or_create(dataset) if 'new' == params[:scorer_id]

    if params[:scorer_id].blank?
      scorer = current_user.default_scorer || Scorer.system_default_scorer
      return unless scorer
    else
      scorer = current_user.scorers_involved_with.find_by(id: params[:scorer_id])
      raise ScorerRefused, 'That scorer is not available to you.' unless scorer
    end
    raise ScorerRefused, "#{scorer.name} can't rate every label in #{dataset.name}: pick a scorer with a wider scale." unless dataset.accepts?(scorer)

    scorer
  end
end
