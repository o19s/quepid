# frozen_string_literal: true

class MigrateAiJudgesToConnections < ActiveRecord::Migration[8.1]
  # Keep the backfill independent of application validations, callbacks and future registries.
  class UserRecord < ActiveRecord::Base
    self.table_name = 'users'
    self.inheritance_column = :_type_disabled
    encrypts :llm_key, deterministic: false
  end

  # AiJudge redeclares User's encrypted attribute. Mirror that inherited type so keys
  # written by either User or AiJudge are decrypted exactly as the running app reads them.
  class JudgeRecord < UserRecord
    encrypts :llm_key, deterministic: false
  end

  class ConnectionRecord < ActiveRecord::Base
    self.table_name = 'connections'
    encrypts :secret, deterministic: false
  end

  class TeamMemberRecord < ActiveRecord::Base
    self.table_name = 'teams_members'
  end

  # Authentication used by the legacy judging adapters, including Ollama's optional bearer key.
  AUTHENTICATION = {
    'openai'                      => [ 'bearer', nil ],
    'azure_openai'                => %w[header api-key],
    'azure_ai_foundry'            => %w[header api-key],
    'azure_ai_foundry_serverless' => %w[header api-key],
    'azure_ai_foundry_anthropic'  => %w[header x-api-key],
    'anthropic'                   => %w[header x-api-key],
    'google_gemini'               => [ 'bearer', nil ],
    'ollama'                      => [ 'bearer', nil ],
    'typesafe_jev'                => [ 'bearer', nil ],
  }.freeze

  def up
    UserRecord.transaction do
      judges = JudgeRecord.where(type: 'AiJudge', connection_id: nil).select do |judge|
        judge.llm_key.present? || judge_options(judge)['llm_service_url'].present?
      end
      owners = judges.to_h { |judge| [ judge.id, owner_id_for(judge) ] }
      missing = owners.select { |_, owner_id| owner_id.nil? }.keys
      raise ActiveRecord::MigrationError, "AI judges #{missing.join(', ')} need an owner: add a human team member or create a human administrator before migrating." if missing.any?

      judges.each do |judge|
        created = ConnectionRecord.create!(connection_attributes(judge, owners.fetch(judge.id)))
        # Keep the old settings intact for the separate, later legacy-column cleanup.
        judge.update!(connection_id: created.id, owner_id: owners.fetch(judge.id))
      end
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration, 'Migrated connections may have been edited or reused. Restore a backup to undo this backfill.'
  end

  private

  def owner_id_for judge
    return judge.owner_id if judge.owner_id

    team_ids = TeamMemberRecord.where(member_id: judge.id).select(:team_id)
    member_ids = TeamMemberRecord.where(team_id: team_ids).select(:member_id)
    UserRecord.where(type: [ nil, '', 'User' ], id: member_ids).minimum(:id) || fallback_admin_id
  end

  # The same row every time (no judge-specific condition), so one query covers every judge
  # that falls through to it rather than repeating it in the per-judge loop.
  def fallback_admin_id
    @fallback_admin_id ||= UserRecord.where(type: [ nil, '', 'User' ], administrator: true).minimum(:id)
  end

  def connection_attributes judge, owner_id
    options = judge_options(judge)
    provider = AUTHENTICATION.key?(options['llm_provider']) ? options['llm_provider'] : 'openai'
    scheme, header = AUTHENTICATION.fetch(provider)
    # Legacy adapters send no auth header without a key, even for providers normally requiring one.
    if judge.llm_key.blank?
      scheme = 'none'
      header = nil
    end
    {
      name:          judge.name,
      owner_id:      owner_id,
      instance_wide: false,
      provider:      provider,
      # LlmService defaults to OpenAI, not the provider's form preset, when these keys are absent.
      base_url:      options.fetch('llm_service_url', 'https://api.openai.com'),
      timeout:       options.fetch('llm_timeout', 30).to_i,
      auth_scheme:   scheme,
      auth_header:   header,
      secret:        judge.llm_key,
      options:       { 'api_version' => options['llm_api_version'] }.compact,
    }
  end

  def judge_options judge
    judge.options&.fetch('judge_options', nil) || {}
  end
end
