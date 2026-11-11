# frozen_string_literal: true

require 'test_helper'

class AiJudgeConnectionMigrationTest < ActiveSupport::TestCase
  setup do
    # Keep pre-existing fixture judges outside this backfill's candidate set.
    AiJudge.update_all(connection_id: connections(:openai).id)
    @owner = users(:random)
  end

  test 'backfills a private connection without changing judging settings or team sharing' do
    judge = legacy_judge
    judge.teams << teams(:shared)
    original_options = judge.options.deep_dup
    original_teams = judge.team_ids.sort
    encrypted_key = judge.read_attribute_before_type_cast(:llm_key)

    assert_difference 'Connection.count', 1 do
      migrate
    end

    judge.reload
    connection = judge.connection
    assert_equal @owner.id, judge.owner_id
    assert_equal @owner, connection.owner
    assert_not_predicate connection, :instance_wide?
    assert_equal judge.name, connection.name
    assert_equal 'openai', connection.provider
    assert_equal 'https://judge.example/prefix', connection.base_url
    assert_equal 'private-key', connection.secret
    assert_equal 45, connection.timeout
    assert_equal 'bearer', connection.auth_scheme
    assert_equal original_options, judge.options
    assert_equal original_teams, judge.team_ids.sort
    assert_equal 'Judge carefully.', judge.system_prompt
    assert_equal encrypted_key, judge.read_attribute_before_type_cast(:llm_key)
    assert_not_equal 'private-key', connection.read_attribute_before_type_cast(:secret)
    assert_predicate connection, :valid?
  end

  test 'ownerless judges use the lowest ID human across all their teams' do
    judge = legacy_judge(owner: nil)
    human_ids = [ users(:doug).id, users(:random).id ].sort
    first_team = Team.create!(name: 'Migration first team')
    second_team = Team.create!(name: 'Migration second team')
    first_team.members << User.find(human_ids.last)
    second_team.members << User.find(human_ids.first)
    first_team.members << users(:judge_judy)
    judge.teams << [ first_team, second_team ]

    migrate

    assert_equal human_ids.first, judge.reload.owner_id
    assert_equal human_ids.first, judge.connection.owner_id
    assert_equal [ first_team.id, second_team.id ].sort, judge.team_ids.sort
  end

  test 'a judge with an owner keeps that owner even if a teammate has a lower ID' do
    human_ids = [ users(:doug).id, users(:random).id ].sort
    judge = legacy_judge(owner: User.find(human_ids.last))
    team = Team.create!(name: 'Migration owned team')
    team.members << User.find(human_ids.first)
    judge.teams << team

    migrate

    assert_equal human_ids.last, judge.reload.owner_id
    assert_equal human_ids.last, judge.connection.owner_id
  end

  test 'a team without humans and a judge without teams fall back to the first human administrator' do
    expected = User.where(type: [ nil, '', 'User' ], administrator: true).minimum(:id)
    teamless = legacy_judge(owner: nil)
    judge_only_team = Team.create!(name: 'Migration judge only')
    judge_only_team.members << users(:judge_judy)
    teamed = legacy_judge(owner: nil)
    teamed.teams << judge_only_team
    users(:judge_judy).update_column(:administrator, true)

    migrate

    [ teamless, teamed ].each do |judge|
      assert_equal expected, judge.reload.owner_id
      assert_equal expected, judge.connection.owner_id
    end
  end

  test 'missing ownership aborts before converting any judges without leaking credentials' do
    owned = legacy_judge
    orphan = legacy_judge(owner: nil)
    User.where(type: [ nil, '', 'User' ]).update_all(administrator: false)

    assert_no_difference 'Connection.count' do
      error = assert_raises(ActiveRecord::MigrationError) { migrate }
      assert_includes error.message, orphan.id.to_s
      assert_includes error.message, 'administrator'
      assert_not_includes error.message, 'private-key'
    end
    assert_nil owned.reload.connection_id
    assert_nil orphan.reload.connection_id
    assert_nil orphan.owner_id
  end

  test 'team members suffice without an administrator and human STI variants are eligible' do
    User.where(type: [ nil, '', 'User' ]).update_all(administrator: false)
    [ nil, '', 'User' ].each_with_index do |type, index|
      member = users(:random)
      member.update_columns(type: type)
      team = Team.create!(name: "Migration human #{index}")
      team.members << member
      judge = legacy_judge(owner: nil)
      judge.teams << team

      migrate

      assert_equal member.id, judge.reload.owner_id
      assert_equal member.id, judge.connection.owner_id
    end
  end

  test 'already connected judges and unconfigured judges and humans are unchanged on replay' do
    judge = legacy_judge
    connected = users(:judge_judy)
    saved_connection_id = connected.connection_id
    unconfigured = legacy_judge(llm_key: nil, judge_options: {})
    human = users(:doug)
    human.update_columns(llm_key: 'human-key')

    migrate
    created_id = judge.reload.connection_id
    assert_no_difference 'Connection.count' do
      migrate
    end

    assert_equal created_id, judge.reload.connection_id
    assert_equal saved_connection_id, connected.reload.connection_id
    assert_nil unconfigured.reload.connection_id
    assert_nil human.reload.connection_id
    assert_equal 'human-key', human.llm_key
  end

  test 'missing transport options retain the legacy service defaults' do
    judge = legacy_judge(judge_options: { llm_provider: 'anthropic', llm_model: 'kept-model' })

    migrate

    assert_equal 'https://api.openai.com', judge.reload.connection.base_url
    assert_equal 30, judge.connection.timeout
    assert_equal 'anthropic', judge.connection.provider
    assert_equal 'header', judge.connection.auth_scheme
    assert_equal 'x-api-key', judge.connection.auth_header
    assert_nil judge.connection.api_version
  end

  test 'provider specific authentication and API version survive migration' do
    {
      'openai'                      => [ 'bearer', nil ],
      'azure_openai'                => %w[header api-key],
      'azure_ai_foundry'            => %w[header api-key],
      'azure_ai_foundry_serverless' => %w[header api-key],
      'anthropic'                   => %w[header x-api-key],
      'azure_ai_foundry_anthropic'  => %w[header x-api-key],
      'google_gemini'               => [ 'bearer', nil ],
      'ollama'                      => [ 'bearer', nil ],
      'typesafe_jev'                => [ 'bearer', nil ],
    }.each do |provider, (scheme, header)|
      judge = legacy_judge(judge_options: { llm_provider: provider, llm_service_url: 'https://custom.example', llm_api_version: 'custom-version' })

      migrate

      assert_equal provider, judge.reload.connection.provider
      assert_equal scheme, judge.connection.auth_scheme
      assert_nil_or_equal header, judge.connection.auth_header
      assert_equal 'custom-version', judge.connection.api_version
      assert_equal 'https://custom.example', judge.connection.base_url
    end
  end

  test 'URL only keyless judges and configured out of range timeouts are preserved' do
    judge = legacy_judge(llm_key: nil, judge_options: { llm_provider: 'ollama', llm_service_url: 'http://ollama:11434', llm_timeout: '900' })

    migrate

    assert_equal 'http://ollama:11434', judge.reload.connection.base_url
    assert_nil judge.connection.secret
    assert_equal 900, judge.connection.timeout
    assert_equal 'ollama', judge.connection.provider
    assert_equal 'none', judge.connection.auth_scheme
  end

  test 'a missing or unknown provider retains OpenAI compatible authentication' do
    judge = legacy_judge(judge_options: { llm_provider: 'old-custom-provider' })

    migrate

    assert_equal 'openai', judge.reload.connection.provider
    assert_equal 'bearer', judge.connection.auth_scheme
    assert_equal 'old-custom-provider', judge.judge_options[:llm_provider]
  end

  test 'a migrated judge sends the same provider request as its legacy configuration' do
    judge = legacy_judge(judge_options: { llm_provider: 'azure_ai_foundry', llm_service_url: 'https://custom.example', llm_model: 'original-model' })
    request = stub_request(:post, 'https://custom.example/models/chat/completions?api-version=2025-01-01-preview')
      .with(headers: { 'api-key' => 'private-key' }, body: hash_including('model' => 'original-model'))
      .to_return(status: 200, body: { choices: [ { message: { content: '{"judgment":2,"explanation":"kept"}' } } ] }.to_json)
    before = judge.llm_service.get_llm_response('Sample', judge.system_prompt)

    migrate

    after = judge.reload.llm_service.get_llm_response('Sample', judge.system_prompt)
    assert_equal before, after
    assert_requested request, times: 2
  end

  test 'keys written by User and legacy plaintext keys also migrate to usable encrypted secrets' do
    singly_encrypted = legacy_judge
    User.find(singly_encrypted.id).update_column(:llm_key, 'user-written-key')
    plaintext = legacy_judge
    User.connection.execute("UPDATE users SET llm_key = 'legacy-plaintext-key' WHERE id = #{plaintext.id}")

    migrate

    assert_equal 'user-written-key', singly_encrypted.reload.connection.secret
    assert_equal 'legacy-plaintext-key', plaintext.reload.connection.secret
    assert_not_equal 'legacy-plaintext-key', plaintext.connection.read_attribute_before_type_cast(:secret)
  end

  test 'rollback cannot delete connections that may have been reused' do
    migration = migration_class.new

    assert_raises(ActiveRecord::IrreversibleMigration) { migration.down }
  end

  private

  def legacy_judge **attributes
    AiJudge.create!(name:          'Migration judge',
                    owner:         @owner,
                    llm_key:       'private-key',
                    system_prompt: 'Judge carefully.',
                    judge_options: { llm_service_url: 'https://judge.example/prefix', llm_timeout: 45, llm_model: 'kept-model' }, **attributes)
  end

  def migration_class
    path = Rails.root.join('db/migrate/20261110120000_migrate_ai_judges_to_connections.rb')
    assert_path_exists path, 'The automatic AI judge connection migration must exist'
    require path
    MigrateAiJudgesToConnections
  end

  def migrate
    capture_io { ActiveRecord::Migration.suppress_messages { migration_class.new.up } }
  end
end
