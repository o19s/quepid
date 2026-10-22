# frozen_string_literal: true

# An AI judge is a User (STI) that produces judgements automatically via an
# LLM instead of logging in and rating documents by hand.
# == Schema Information
#
# Table name: users
#
#  id                          :integer          not null, primary key
#  administrator               :boolean          default(FALSE)
#  agreed                      :boolean
#  agreed_time                 :datetime
#  company                     :string(255)
#  completed_case_wizard       :boolean          default(FALSE), not null
#  email                       :string(80)
#  email_marketing             :boolean          default(FALSE), not null
#  invitation_accepted_at      :datetime
#  invitation_created_at       :datetime
#  invitation_limit            :integer
#  invitation_sent_at          :datetime
#  invitation_token            :string(255)
#  invitations_count           :integer          default(0)
#  llm_key                     :string(4000)
#  locked                      :boolean
#  locked_at                   :datetime
#  name                        :string(255)
#  num_logins                  :integer
#  options                     :json
#  password                    :string(120)
#  profile_pic                 :string(4000)
#  reset_password_sent_at      :datetime
#  reset_password_token        :string(255)
#  stored_raw_invitation_token :string(255)
#  system_prompt               :string(4000)
#  type                        :string(255)
#  created_at                  :datetime         not null
#  updated_at                  :datetime         not null
#  default_scorer_id           :integer
#  escalates_to_id             :integer
#  invited_by_id               :integer
#  owner_id                    :integer
#
# Indexes
#
#  index_users_on_default_scorer_id     (default_scorer_id)
#  index_users_on_escalates_to_id       (escalates_to_id)
#  index_users_on_invitation_token      (invitation_token) UNIQUE
#  index_users_on_invited_by_id         (invited_by_id)
#  index_users_on_name                  (name)
#  index_users_on_reset_password_token  (reset_password_token) UNIQUE
#  index_users_on_type                  (type)
#  index_users_owner_id                 (owner_id)
#  ix_user_username                     (email) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (default_scorer_id => scorers.id)
#  fk_rails_...  (escalates_to_id => users.id) ON DELETE => nullify
#  fk_rails_...  (invited_by_id => users.id)
#
class AiJudge < User
  encrypts :llm_key, deterministic: false

  belongs_to :owner, class_name: 'User', optional: true

  # The judge this one wakes when it is unsure of an answer. A judge that
  # another judge points at is on call: it sleeps until escalated to
  # (docs/todo/escalating_judges.md).
  belongs_to :escalates_to,
             class_name: 'AiJudge',
             optional:   true,
             inverse_of: :escalated_from
  has_many :escalated_from,
           class_name:  'AiJudge',
           foreign_key: :escalates_to_id,
           inverse_of:  :escalates_to,
           dependent:   :nullify

  # Only AiJudge (not User generally) has an owner to scope by - keep the
  # concern here rather than on User, where for_user(user) would build SQL
  # against a nonexistent users.owner column.
  include ForUserScope

  validates :name, presence: true
  validates :llm_key, length: { maximum: 255 }, allow_blank: true
  validates :system_prompt, length: { maximum: 4000 }, allow_nil: true, presence: true
  validate :escalation_chain_does_not_loop, if: :escalates_to_id_changed?

  def on_call?
    escalated_from.any?
  end

  # "Judge A and Judge B", for the "woken by"/"on call for" messaging shown
  # wherever this judge's on-call status is displayed.
  def escalated_from_names
    escalated_from.map(&:name).sort.to_sentence
  end

  # { judge id => name of the judge it wakes } for those of `ids` that wake
  # somebody, in two queries -- for pages that list many judges.
  def self.escalation_target_names ids
    links = where(id: ids).where.not(escalates_to_id: nil).pluck(:id, :escalates_to_id)
    names = where(id: links.map(&:last)).pluck(:id, :name).to_h
    links.to_h { |id, target_id| [ id, names[target_id] ] }
  end

  def judge_options
    opts = options&.dig('judge_options') || {}
    opts.deep_symbolize_keys
  end

  # `options` is a JSON column, so the merge key must match the string key the reader
  # looks up -- merging under a symbol leaves a duplicate "judge_options" entry in the
  # serialized JSON, which `json` 3.0 refuses to parse back. The value is stringified
  # too, so the in-memory object already matches what a reload from the database returns.
  def judge_options= value
    self.options = (options || {}).merge('judge_options' => value.to_h.deep_stringify_keys)
  end

  private

  # A loop would leave every judge in it on call, so nobody in it would ever
  # judge. Walks the chain from the new target; it is short, so one query per
  # step is fine.
  def escalation_chain_does_not_loop
    if escalates_to_id.present? && escalates_to_id == id
      errors.add(:escalates_to, 'cannot be this judge itself')
      return
    end

    seen = Set.new
    current = escalates_to
    while current
      if current.id == id || !seen.add?(current.id)
        errors.add(:escalates_to, 'would wake a judge that already escalates back to this one')
        return
      end
      current = current.escalates_to
    end
  end
end
