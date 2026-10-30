# frozen_string_literal: true

# Builds a scorer that matches a dataset's labels exactly (its scale and the label names), as a copy
# of a communal scorer used as the template: the metric's code is the template's, the scale and labels
# are the dataset's. A user can have one per template, named "<dataset name> <template name>".
class DatasetScorer
  class Error < StandardError; end

  # The template used when none is chosen: AP@10 counts any rating above 0 as relevant, so it works on any scale.
  DEFAULT_TEMPLATE = 'AP@10'

  def self.scorer_name dataset, template_name = DEFAULT_TEMPLATE
    "#{dataset.name} #{template_name}"
  end

  # The dataset a scorer was made for, if any: its name starts with the dataset's name and it has exactly its scale and
  # labels, which is what Create scorer makes; what follows the name is the template it was copied from.
  def self.dataset_of scorer
    DatasetCatalog::ENTRIES.find do |entry|
      entry.scale_labels.present? && scorer.name.to_s.start_with?("#{entry.name} ") &&
        scorer.scale == entry.scale && scorer.scale_with_labels == entry.scale_labels
    end
  end

  # The communal scorers that can be a template.
  def self.templates
    Scorer.communal.order(:name)
  end

  def initialize user
    @user = user
  end

  # The scorer this user built for the dataset (a catalog entry) from the template: theirs, named for both,
  # with exactly the dataset's scale and labels. Nil if there is none (also for a dataset without labels).
  def find dataset, template = default_template
    return if dataset.scale_labels.blank? || template.nil?

    Scorer.where(owner: @user, name: self.class.scorer_name(dataset, template.name)).find do |scorer|
      scorer.scale == dataset.scale && scorer.scale_with_labels == dataset.scale_labels
    end
  end

  # The templates this user has not built a scorer from for the dataset yet.
  def templates_left dataset
    self.class.templates.reject { |template| find(dataset, template) }
  end

  def find_or_create dataset, template = nil
    raise Error, "#{dataset.name} doesn't declare labels to build a scorer from." if dataset.scale_labels.blank?

    template ||= default_template || raise(Error, "The communal #{DEFAULT_TEMPLATE} scorer is missing, so there is no metric to build on.")
    scorer = find(dataset, template) || create_scorer(dataset, template)
    # The Dataset record remembers the latest as the dataset's scorer, which the create-case dialog preselects.
    ::Dataset.for(@user, dataset.key).update!(scorer: scorer)
    scorer
  end

  private

  def default_template
    Scorer.communal.find_by(name: DEFAULT_TEMPLATE)
  end

  def create_scorer dataset, template
    Scorer.create!(
      owner:             @user,
      name:              self.class.scorer_name(dataset, template.name),
      code:              template.code,
      scale:             dataset.scale,
      scale_with_labels: dataset.scale_labels,
      show_scale_labels: true,
      communal:          false
    )
  end
end
