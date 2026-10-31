# frozen_string_literal: true

module Datasets
  # Makes the user a scorer with exactly this dataset's scale and labels, as a copy of the communal scorer they picked
  # as the template.
  class ScorersController < ApplicationController
    def create
      dataset = DatasetCatalog.find(params.expect(:dataset_id))
      return redirect_to(datasets_path, alert: 'That dataset has no labels to build a scorer from.', status: :see_other) unless dataset&.available && dataset.scale_labels.present?

      template = DatasetScorer.templates.find_by(id: params.fetch(:template_id, nil))
      return redirect_to(datasets_path, alert: 'Pick a communal scorer to use as the template.', status: :see_other) unless template

      scorer = DatasetScorer.new(current_user).find_or_create(dataset, template)
      notice = scorer.previously_new_record? ? "Created the scorer #{scorer.name}." : "You already have the scorer #{scorer.name}."
      redirect_to datasets_path, notice: notice, status: :see_other
    rescue DatasetScorer::Error, ActiveRecord::RecordInvalid => e
      redirect_to datasets_path, alert: "Could not create the scorer: #{e.message}", status: :see_other
    end
  end
end
