# frozen_string_literal: true

# The scorers made for the example datasets, and the cases that use them.
class DatasetScorersController < ApplicationController
  Row = Struct.new(:scorer, :dataset, :based_on, :cases, keyword_init: true)

  def index
    scorers = current_user.scorers_involved_with.order(:name).to_a
    cases = current_user.cases_involved_with.where(scorer_id: scorers.map(&:id), archived: [ false, nil ]).order(:case_name).group_by(&:scorer_id)
    @rows = scorers.filter_map { |scorer| row_for(scorer, cases.fetch(scorer.id, [])) }
  end

  private

  # A scorer is a dataset's own when its name starts with the dataset's name and it has exactly its scale and
  # labels, which is what Create scorer makes; what follows the name is the template it was copied from.
  def row_for scorer, cases
    dataset = DatasetCatalog::ENTRIES.find do |entry|
      entry.scale_labels.present? && scorer.name.to_s.start_with?("#{entry.name} ") &&
        scorer.scale == entry.scale && scorer.scale_with_labels == entry.scale_labels
    end
    return unless dataset

    Row.new(scorer: scorer, dataset: dataset, based_on: scorer.name.delete_prefix("#{dataset.name} "), cases: cases)
  end
end
