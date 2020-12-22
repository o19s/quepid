# frozen_string_literal: true

# == Schema Information
#
# Table name: queries
#
#  id             :integer          not null, primary key
#  arranged_next  :integer
#  arranged_at    :integer
#  deleted        :boolean
#  query_text     :string(191)
#  notes          :text(65535)
#  threshold      :float(24)
#  threshold_enbl :boolean
#  case_id        :integer
#  scorer_id      :integer
#  scorer_enbl    :boolean
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  options        :text(65535)
#

require 'arrangement/item'

class Query < ApplicationRecord
  # Arrangement
  include Arrangement::Item

  # Associations
  belongs_to  :scorer, optional: true
  belongs_to  :case, autosave: true, optional: false

  has_many    :ratings,
              dependent:  :destroy

  # the queries.scorer_enbl field determines if this ad hoc unit test style scorer
  # is actually in use or not.   When you pick your ad hoc scorer, we flip this bit
  # and you haven't lost the query!  One thing is that they never get deleted because
  # we soft delete a query, so the :destroy never gets called.
  has_one     :test,
              class_name: 'Scorer',
              dependent:  :destroy

  # Validations
  validates :query_text,
            presence: true

  # Scopes
  default_scope -> { where(deleted: false).or(where(deleted: nil)) }

  # TODO: use the acts_as_paranoid gem instead
  # Which requires change to the db, that is not going to be done in the
  # initial scope of work in the rails migration
  def soft_delete
    update deleted: true
  end

  def parent_list
    self.case.queries
  end

  def list_owner
    self.case
  end

  # FIXME.  Nate, our front end doesn't support decimals at this time, yet
  # this does decimals.  https://imgflip.com/i/4rahhg
  RatingAveraged = Struct.new(:doc_id, :query_id, :rating)

  def ratings_averaged
    average_ratings_by_doc = {}
    ratings.each do | rating |
      if average_ratings_by_doc.has_key? rating.doc_id
        average_ratings_by_doc[rating.doc_id][:ratings] << rating[:rating].to_f
      else
        average_ratings_by_doc[rating.doc_id] = { doc_id: rating[:doc_id], query_id: rating[:query_id], ratings: [rating[:rating].to_f] }
      end
    end
    ratings_averaged = []
    average_ratings_by_doc.each do |key, value |
      sum = value[:ratings].inject(0, :+)
      value[:rating] = ( sum / value[:ratings].size ).round(0)

      ratings_averaged << RatingAveraged.new(value[:doc_id], value[:query_id], value[:rating])
    end
    ratings_averaged
  end
end
