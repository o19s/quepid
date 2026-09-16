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
#  invited_by_id               :integer
#  owner_id                    :integer
#
# Indexes
#
#  index_users_on_default_scorer_id     (default_scorer_id)
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
#  fk_rails_...  (invited_by_id => users.id)
#
class AiJudge < User
  validates :name, presence: true
  # Optional - LlmService skips auth headers entirely when llm_key is blank,
  # which is correct for a local provider (e.g. Ollama) that doesn't check one.
  validates :llm_key, length: { maximum: 255 }, allow_blank: true
  validates :system_prompt, length: { maximum: 4000 }, allow_nil: true, presence: true
end
