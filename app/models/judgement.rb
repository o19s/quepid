# frozen_string_literal: true

# == Schema Information
#
# Table name: judgements
#
#  id                          :bigint           not null, primary key
#  explanation                 :text(65535)
#  judge_later                 :boolean          default(FALSE)
#  rating                      :float(24)
#  unrateable                  :boolean          default(FALSE)
#  created_at                  :datetime         not null
#  updated_at                  :datetime         not null
#  escalated_from_judgement_id :bigint
#  query_doc_pair_id           :bigint           not null
#  user_id                     :integer
#
# Indexes
#
#  index_judgements_on_escalated_from_judgement_id    (escalated_from_judgement_id) UNIQUE
#  index_judgements_on_query_doc_pair_id              (query_doc_pair_id)
#  index_judgements_on_user_id_and_query_doc_pair_id  (user_id,query_doc_pair_id) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (escalated_from_judgement_id => judgements.id) ON DELETE => nullify
#  fk_rails_...  (query_doc_pair_id => query_doc_pairs.id)
#
class Judgement < ApplicationRecord
  belongs_to :query_doc_pair
  belongs_to :user, optional: true

  # Set when an on-call judge made this judgement because another judge's
  # answer on the same pair was unrateable (docs/todo/escalating_judges.md).
  belongs_to :escalated_from_judgement,
             class_name: 'Judgement',
             optional:   true,
             inverse_of: :escalation
  has_one :escalation,
          class_name:  'Judgement',
          foreign_key: :escalated_from_judgement_id,
          inverse_of:  :escalated_from_judgement,
          dependent:   :nullify

  validates :user_id, :uniqueness => { :scope => :query_doc_pair_id }, unless: -> { user_id.nil? }
  validates :rating,
            presence: true, unless: :rating_not_required?

  def rating_not_required?
    unrateable || judge_later
  end

  scope :rateable, -> { where(unrateable: false).where(judge_later: false) }

  # `from`'s unrateable judgements in `book` that nobody has escalated yet,
  # skipping pairs `to` has already judged (it can't judge a pair twice).
  # A judge marking a pair "judge later" is a person deferring, not a judge
  # failing, so only unrateable counts.
  scope :awaiting_escalation, ->(book, from:, to:) do
    joins(:query_doc_pair)
      .where(query_doc_pairs: { book_id: book.id })
      .where(user: from, unrateable: true)
      .where.not(id: Judgement.where.not(escalated_from_judgement_id: nil).select(:escalated_from_judgement_id))
      .where.not(query_doc_pair_id: Judgement.where(user: to).select(:query_doc_pair_id))
  end

  def check_unrateable_for_rating
  end

  def rating= val
    self.unrateable = false unless val.nil?
    self.judge_later = false unless val.nil?
    write_attribute(:rating, val)
  end

  # Why an AI judge's answer was unrateable, as a phrase ("its confidence
  # (0.64) was below its minimum confidence of 0.8"). Read back from the notes
  # the judging path writes into the explanation; nil for a judgement that is
  # rateable or wasn't made by an AI judge.
  def unrateable_reason
    return unless unrateable && user&.ai_judge?

    text = explanation.to_s
    # An escalated judgement's explanation opens with a note quoting the
    # judgement it answers (RunJudgeJudyJob#escalation_note); that judge's
    # reason isn't this one's, so read only what follows it.
    text = text.split("\n\n", 2).last.to_s if escalated_from_judgement_id
    if (floor = text.match(/\[confidence (\S+) is below this judge's minimum confidence of ([^,\]]+)/))
      "its confidence (#{floor[1]}) was below its minimum confidence of #{floor[2]}"
    elsif text.include?('outside the scale')
      "its rating wasn't one of the book's scale values"
    elsif text.start_with?('BOOM')
      'the call to the model failed'
    else
      'it gave no rating'
    end
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
end
