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

  def row_for scorer, cases
    dataset = DatasetScorer.dataset_of(scorer)
    return unless dataset

    Row.new(scorer: scorer, dataset: dataset, based_on: scorer.name.delete_prefix("#{dataset.name} "), cases: cases)
  end
end
