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
    return redirect_to(dataset_cases_path, alert: 'Pick a dataset that is available.') unless dataset&.available

    sample = sample_size(dataset)
    case_name = params[:case_name].presence || default_name(dataset, sample)
    scorer = chosen_scorer(dataset)
    link = make_case(dataset, case_name, scorer, sample)
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
    return redirect_to(dataset_cases_path, alert: "#{kase.case_name} is still loading: uninstall it when that has finished.") if link.in_progress?
    return redirect_to(dataset_cases_path, alert: "#{kase.case_name} belongs to someone else, so it cannot be uninstalled from here.") unless kase.owner_id == current_user.id

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
    @document_counts = document_counts(case_ids)
    # The search endpoint a case uses is its latest try's.
    @endpoints = Try.where(case_id: case_ids).includes(:search_endpoint).order(try_number: :desc).group_by(&:case_id)
      .transform_values { |tries| tries.first.search_endpoint }
  end

  # What the two dialogs need: Create new (datasets and scorers) and Initiate indexing (search endpoints).
  def load_dialogs
    @datasets = DatasetCatalog.loadable_first.select(&:available)
    @open_dataset = @datasets.find { |dataset| dataset.key == params.fetch(:dataset, nil) }
    @scorers = current_user.scorers_involved_with.order(:name)
    @default_scorer = current_user.default_scorer || Scorer.system_default_scorer
    records = Dataset.where(owner: current_user).includes(:scorer, :search_endpoint).index_by(&:key)
    # The scorer the user built for each dataset with labels, if any (the dialog offers to create it otherwise).
    @dataset_scorers = records.transform_values(&:scorer)
    # Where each dataset is hosted, if the user said so: the fallback for a case that has no endpoint of its own.
    @dataset_endpoints = records.transform_values(&:search_endpoint)
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
  # whose scale covers them. Blank means the user's default.
  def chosen_scorer dataset
    return DatasetScorer.new(current_user).find_or_create(dataset) if 'new' == params[:scorer_id]
    return if params[:scorer_id].blank?

    scorer = current_user.scorers_involved_with.find_by(id: params[:scorer_id])
    raise ScorerRefused, 'That scorer is not available to you.' unless scorer
    raise ScorerRefused, "#{scorer.name} can't rate every label in #{dataset.name}: pick a scorer with a wider scale." unless dataset.accepts?(scorer)

    scorer
  end

  # The empty case, linked to the dataset as pending, remembering if it is only a sample of it.
  def make_case dataset, case_name, scorer, sample
    ActiveRecord::Base.transaction do
      kase = Case.create!(case_name: case_name, owner: current_user, scorer: scorer)
      CaseToDataset.create!(dataset: Dataset.for(current_user, dataset.key), case: kase, sample_size: sample)
    end
  end

  # Distinct documents per case: those rated in it plus those in its judgement book's query-document pairs.
  # One UNION in SQL, so a big case isn't loaded into Ruby to be counted.
  def document_counts case_ids
    return {} if case_ids.empty?

    sql = ActiveRecord::Base.sanitize_sql_array([ <<~SQL.squish, case_ids, case_ids ])
      SELECT docs.case_id, COUNT(DISTINCT docs.doc_id)
      FROM (
        SELECT queries.case_id AS case_id, ratings.doc_id AS doc_id
          FROM ratings INNER JOIN queries ON queries.id = ratings.query_id
          WHERE queries.case_id IN (?)
        UNION
        SELECT cases.id AS case_id, query_doc_pairs.doc_id AS doc_id
          FROM cases INNER JOIN query_doc_pairs ON query_doc_pairs.book_id = cases.book_id
          WHERE cases.id IN (?)
      ) docs
      GROUP BY docs.case_id
    SQL
    ActiveRecord::Base.connection.select_rows(sql).to_h { |case_id, count| [ case_id.to_i, count.to_i ] }
  end
end
