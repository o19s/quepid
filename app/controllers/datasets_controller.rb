# frozen_string_literal: true

# The example datasets Quepid offers (DatasetCatalog), and the scorers made for them. Making cases from
# them is DatasetCasesController's.
class DatasetsController < ApplicationController
  def index
    @datasets = DatasetCatalog.loadable_first
    # The scorers the user can see whose names start with the dataset's name, e.g. 'Haystack Rating Party Scorer'.
    visible = current_user.scorers_involved_with.order(:name).to_a
    @dataset_scorers = @datasets.to_h { |dataset| [ dataset.key, visible.select { |scorer| scorer.name.to_s.start_with?(dataset.name) } ] }
    # The templates the user can still build a scorer for, per dataset with labels; Create scorer asks which.
    maker = DatasetScorer.new(current_user)
    @templates_left = @datasets.select { |dataset| dataset.available && dataset.scale_labels.present? }
      .to_h { |dataset| [ dataset.key, maker.templates_left(dataset) ] }
    # How many live cases the user has made from each dataset.
    @case_counts = Dataset.where(owner: current_user).index_by(&:key)
      .transform_values { |record| record.cases.where(archived: [ false, nil ]).count }
  end

  # Makes the user a scorer with exactly this dataset's scale and labels, as a copy of the communal scorer
  # they picked as the template.
  def scorer
    dataset = DatasetCatalog.find(params.expect(:id))
    return redirect_to(datasets_path, alert: 'That dataset has no labels to build a scorer from.') unless dataset&.available && dataset.scale_labels.present?

    template = DatasetScorer.templates.find_by(id: params.fetch(:template_id, nil))
    return redirect_to(datasets_path, alert: 'Pick a communal scorer to use as the template.') unless template

    scorer = DatasetScorer.new(current_user).find_or_create(dataset, template)
    notice = scorer.previously_new_record? ? "Created the scorer #{scorer.name}." : "You already have the scorer #{scorer.name}."
    redirect_to datasets_path, notice: notice
  rescue DatasetScorer::Error, ActiveRecord::RecordInvalid => e
    redirect_to datasets_path, alert: "Could not create the scorer: #{e.message}"
  end
end
