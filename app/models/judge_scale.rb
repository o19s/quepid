# frozen_string_literal: true

# A rating scale: which ratings are legal, how to describe them, and any
# guidance on applying them.
#
# Not an ActiveRecord model -- a value object, and the only thing an AI judge
# is handed. A judge is told the scale to use, the same way a human judge is;
# it never sees the Book the scale came from. The edges that start judging
# (RunJudgeJudyJob, AiJudges::WizardController) build one with JudgeScale.for
# and pass it down to LlmService, the adapters and JudgementFinalizer.
#
# `Book#scale` is already a sorted Array of Integers (see ScaleSerializer), and
# `Book#scale_with_labels` is a JSON hash keyed by the rating as a String.
class JudgeScale
  # Scale labels are free text set by whoever owns the book (e.g. via a scorer's
  # scale_with_labels) and get interpolated into an LLM prompt, so they are
  # collapsed to a single trimmed, length-capped line first.
  MAX_LABEL_LENGTH = 60

  attr_reader :values, :guidelines

  delegate :empty?, :size, to: :values

  def self.for book
    new(book&.scale, book&.scale_with_labels, guidelines: book&.scoring_guidelines)
  end

  # @param guidelines [String, nil] free-text advice on applying the scale
  #   (Book#scoring_guidelines), for a judge that can be told it.
  def initialize values, labels = nil, guidelines: nil
    @values = Array(values).freeze
    # scale_with_labels is JSON-deserialized stored data (e.g. from an imported
    # book file) with no guaranteed shape -- fall back to "no labels" for
    # anything that isn't actually a Hash, rather than raising (Array/String#[]
    # don't accept a String key the way Hash#[] does).
    @labels = labels.is_a?(Hash) ? labels : {}
    @guidelines = guidelines.presence

    freeze
  end

  # No scale at all: nothing to describe to a judge and nothing to validate against.
  NONE = new([])

  def label_for value
    label = @labels[value.to_s]
    return nil if label.blank?

    label.to_s.gsub(/[\r\n]+/, ' ').strip.truncate(MAX_LABEL_LENGTH)
  end

  # The scale as told to an LLM, e.g. '0 (labeled "Not Relevant"), 1'.
  def describe
    values.map do |value|
      label = label_for(value)
      label.present? ? "#{value} (labeled #{label.inspect})" : value.to_s
    end.join(', ')
  end

  # The scale as an ordered list of level descriptions, low to high -- what a
  # model that is handed the scale itself (rather than told about it in prose)
  # is asked to rate against. Values with no label still need describing, so
  # they fall back to naming the number.
  def criteria
    values.map { |value| label_for(value) || "Rating #{value} on this book's scale" }
  end

  # Same thing keyed by the rating, for a model that picks an option rather
  # than a position on a spectrum.
  def criteria_by_value
    values.map(&:to_s).zip(criteria).to_h
  end

  # Turns a position on the level spectrum (0 .. size - 1, possibly fractional,
  # as a probability-weighted model answers) into one of this book's actual
  # rating values. Rounds to the nearest level and clamps to the ends, because
  # a rating between two scale points is not a rating a human judge could give.
  def value_for_level level
    return nil if empty? || level.nil?

    values[level.to_f.round.clamp(0, size - 1)]
  end

  # Is this a rating a human judge could also have given? Ratings arrive as
  # floats (judgements.rating is a float column) while the scale is integers,
  # so both sides are compared as floats -- exactly, with no tolerance: a value
  # between two scale points is not on the scale.
  def includes? rating
    return false if rating.nil?

    values.map(&:to_f).include?(rating.to_f)
  end
end
