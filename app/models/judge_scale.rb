# frozen_string_literal: true

# A book's rating scale: which ratings are legal, and how to describe them.
#
# Not an ActiveRecord model -- a value object built from a Book, so the one
# definition of "legal rating for this book" is shared by everything that needs
# it: the system prompt an LLM judge is given (LlmService), and the check that
# decides whether a returned rating is usable (RunJudgeJudyJob).
#
# `Book#scale` is already a sorted Array of Integers (see ScaleSerializer), and
# `Book#scale_with_labels` is a JSON hash keyed by the rating as a String.
class JudgeScale
  # Scale labels are free text set by whoever owns the book (e.g. via a scorer's
  # scale_with_labels) and get interpolated into an LLM prompt, so they are
  # collapsed to a single trimmed, length-capped line first.
  MAX_LABEL_LENGTH = 60

  attr_reader :values

  delegate :empty?, :size, to: :values

  def self.for book
    new(book&.scale, book&.scale_with_labels)
  end

  def initialize values, labels = nil
    @values = Array(values).freeze
    # scale_with_labels is JSON-deserialized stored data (e.g. from an imported
    # book file) with no guaranteed shape -- fall back to "no labels" for
    # anything that isn't actually a Hash, rather than raising (Array/String#[]
    # don't accept a String key the way Hash#[] does).
    @labels = labels.is_a?(Hash) ? labels : {}

    freeze
  end

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

  # Is this a rating a human judge could also have given? Ratings arrive as
  # floats (judgements.rating is a float column) while the scale is integers,
  # so both sides are compared as floats -- exactly, with no tolerance: a value
  # between two scale points is not on the scale.
  def includes? rating
    return false if rating.nil?

    values.map(&:to_f).include?(rating.to_f)
  end
end
