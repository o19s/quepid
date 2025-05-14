# frozen_string_literal: true

# == Schema Information
#
# Table name: judgements
#
#  id                :bigint           not null, primary key
#  explanation       :text(65535)
#  judge_later       :boolean          default(FALSE)
#  rating            :float(24)
#  unrateable        :boolean          default(FALSE)
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  query_doc_pair_id :bigint           not null
#  user_id           :integer
#
# Indexes
#
#  index_judgements_on_query_doc_pair_id              (query_doc_pair_id)
#  index_judgements_on_user_id_and_query_doc_pair_id  (user_id,query_doc_pair_id) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (query_doc_pair_id => query_doc_pairs.id)
#
class Judgement < ApplicationRecord
  belongs_to :query_doc_pair
  belongs_to :user, optional: true

  validates :user_id, :uniqueness => { :scope => :query_doc_pair_id }, unless: -> { user_id.nil? }
  validates :rating,
            presence: true, unless: :rating_not_required?

  def rating_not_required?
    unrateable || judge_later
  end

  scope :rateable, -> { where(unrateable: false).where(judge_later: false) }

  def check_unrateable_for_rating
  end

  def rating= val
    self.unrateable = false unless val.nil?
    self.judge_later = false unless val.nil?
    write_attribute(:rating, val)
  end

  def mark_unrateable
    self.unrateable = true
    self.rating = nil
  end

  def mark_unrateable!
    mark_unrateable
    save
  end

  def mark_judge_later
    self.judge_later = true
    self.rating = nil
  end

  def mark_judge_later!
    mark_judge_later
    save
  end

  # Based on a judgement, find the previous one made by the
  # same user, but prior to that judgement, or return the most recent judgement!
  def previous_judgement_made
    query_doc_pair.book.judgements.where(judgements: { user: user }).where(judgements: { updated_at: ...(updated_at.nil? ? DateTime.current : updated_at) }).reorder('judgements.updated_at DESC').first
  end
  # rubocop:enable Layout/LineLength
end
