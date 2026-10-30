# frozen_string_literal: true

# The example datasets Quepid offers (DatasetCatalog), and the scorers made for them (Datasets::ScorersController).
# Making cases from them is DatasetCasesController's.
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
end
