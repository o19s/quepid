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
#  connection_id               :bigint
#  default_scorer_id           :integer
#  escalates_to_id             :integer
#  invited_by_id               :integer
#  owner_id                    :integer
#
# Indexes
#
#  index_users_on_connection_id         (connection_id)
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

  # Where to reach the provider and the key to use (ADR 0005). Judges made before connections have
  # none and keep running on their own llm_key and URL until someone moves them onto one; new
  # judges get one (AiJudgesController requires it, so code that builds judges directly needn't).
  belongs_to :connection, optional: true, inverse_of: :ai_judges

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
  include ConnectionConsumer

  before_validation :leave_own_settings_for_connection

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

  # The provider the judge speaks. Judges saved before providers were a concept are OpenAI-shaped.
  def llm_provider_key
    LlmProvider.find(judge_options[:llm_provider])&.key || 'openai'
  end

  # Made before connections and not moved onto one yet: it calls out with its own key and URL.
  def own_settings?
    connection_id.nil? && (llm_key.present? || judge_options[:llm_service_url].present?)
  end

  # Runs this judge's calls: through its connection, or on its own settings if it predates them.
  def llm_service
    LlmService.new(llm_key, judge_options, connection)
  end

  def judge_options
    opts = options&.dig('judge_options') || {}
    opts.deep_symbolize_keys
  end

  def judge_options= value
    self.options = (options || {}).merge('judge_options' => value.to_h.deep_stringify_keys)
  end

  # The judge_options a judge would end up with once connected: the provider becomes the
  # connection's. Shared by leave_own_settings_for_connection (actually saving) and the wizard's
  # draft_judge (previewing a connection switch before anyone saves).
  def self.judge_options_with_connection_provider judge_options, connection
    return judge_options unless connection && LlmProvider.find(connection.provider)

    judge_options.merge(llm_provider: connection.provider)
  end

  private

  # Why the connection doesn't fit this judge, or nil. The first thing wrong is the one worth saying.
  def connection_problem
    definition = connection.provider_definition
    label = definition&.label || connection.provider
    return "to #{label} can't run an AI judge" unless definition&.capabilities&.intersect?(%w[chat typed_judge])

    "isn't one you can use" unless connection_usable_by_owner?
  end

  # On a connection, the judge's own key, URL and timeout are no longer used, so they aren't kept,
  # and the provider is the connection's.
  def leave_own_settings_for_connection
    return unless connection

    self.llm_key = nil
    self.judge_options = self.class
      .judge_options_with_connection_provider(judge_options, connection)
      .except(:llm_service_url, :llm_timeout)
  end

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
