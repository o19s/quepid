# frozen_string_literal: true

require 'test_helper'

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
class AiJudgeTest < ActiveSupport::TestCase
  describe 'STI classification' do
    it 'is a User' do
      assert_kind_of User, AiJudge.new(llm_key: '1234', name: 'Judge Judy')
    end

    it 'reports ai_judge? true, unlike a plain User' do
      judge = AiJudge.new(llm_key: '1234', name: 'Judge Judy')
      assert_predicate judge, :ai_judge?
      assert_not_predicate User.new, :ai_judge?
    end

    it 'AiJudge.all only returns AI judges, even mixed in with humans' do
      human = User.create!(email: 'human-for-ai-judge-test@example.com', password: 'password')
      judge = AiJudge.create!(llm_key: '1234', name: 'Judge Judy')

      assert_includes AiJudge.all, judge
      assert_not_includes AiJudge.all, human
    end
  end

  describe 'validations' do
    it 'does not require an email or password address to be valid' do
      judge = AiJudge.new(llm_key: '1234', name: 'Judge Judy')
      assert_predicate judge, :valid?
    end

    it 'requires a name' do
      judge = AiJudge.new(llm_key: '1234')
      assert_not judge.valid?
      judge.name = 'Judge Judy'
      assert_predicate judge, :valid?
    end

    it 'does not require an llm_key, since a local LLM provider may not check one' do
      judge = AiJudge.new(name: 'Judge Judy')
      assert_predicate judge, :valid?
    end

    it 'still enforces the llm_key length limit when one is provided' do
      judge = AiJudge.new(name: 'Judge Judy', llm_key: 'x' * 256)
      assert_not judge.valid?
    end
  end

  describe 'options to configure the llm server' do
    it 'provides an empty hash' do
      judge = AiJudge.new(llm_key: '1234', name: 'Judge Judy')
      opts_hash = judge.judge_options
      assert_empty(opts_hash)
    end

    it 'lets you update the options hash via passing in a hash with new values' do
      judge = AiJudge.new(llm_key: '1234', name: 'Judge Judy')
      opts_hash = judge.judge_options

      opts_hash[:model] = 'gpt-3.5-turbo'
      assert_equal('gpt-3.5-turbo', opts_hash[:model])
      judge.judge_options = opts_hash
      judge.save!

      judge.reload
      assert_equal('gpt-3.5-turbo', judge.judge_options[:model])
    end

    it 'works with other prexisting options' do
      judge_judy = users(:judge_judy)
      judge_judy.options = { special_options: { key1: 'opt1', key2: 2, key3: true } }
      assert judge_judy.save

      judge_options = judge_judy.judge_options
      judge_options[:model] = 'gpt-3.5-turbo'
      judge_judy.judge_options = judge_options
      assert judge_judy.save!
      judge_judy.reload

      judge_options = judge_judy.judge_options
      assert_equal('gpt-3.5-turbo', judge_options[:model])
    end

    it 'stores everything under one string key, whatever keys you hand it' do
      judge = AiJudge.new(llm_key: '1234', name: 'Judge Judy')

      judge.judge_options = { 'llm_provider' => 'openai' }
      judge.judge_options = { llm_provider: 'ollama', llm_model: 'qwen3:0.6b' }
      judge.save!

      # A symbol key here would sit alongside the string one and serialize to a JSON
      # object with two "judge_options" entries.
      assert_equal [ 'judge_options' ], judge.read_attribute(:options).keys
      assert_equal 1, judge.read_attribute(:options).to_json.scan('judge_options').size

      judge.reload
      assert_equal 'ollama', judge.judge_options[:llm_provider]
      assert_equal 'qwen3:0.6b', judge.judge_options[:llm_model]
    end

    it 'keeps other options entries when judge options are written' do
      judge = AiJudge.new(llm_key: '1234', name: 'Judge Judy', options: { 'special_options' => { 'key1' => 'opt1' } })

      judge.judge_options = { llm_provider: 'openai' }
      judge.save!
      judge.reload

      assert_equal 'opt1', judge.options.dig('special_options', 'key1')
      assert_equal 'openai', judge.judge_options[:llm_provider]
    end
  end

  describe 'escalation' do
    let(:cheap) { AiJudge.create!(name: 'Cheap Judge') }
    let(:expensive) { AiJudge.create!(name: 'Expensive Judge') }

    it 'wakes nobody by default, and is not on call' do
      assert_nil cheap.escalates_to
      assert_not_predicate cheap, :on_call?
    end

    it 'makes the judge it wakes on call, and only that one' do
      cheap.update!(escalates_to: expensive)

      assert_predicate expensive.reload, :on_call?
      assert_equal [ cheap ], expensive.escalated_from.to_a
      assert_not_predicate cheap.reload, :on_call?
    end

    it 'allows a chain longer than two' do
      top = AiJudge.create!(name: 'Top Judge')
      expensive.update!(escalates_to: top)

      cheap.escalates_to = expensive
      assert_predicate cheap, :valid?
    end

    it 'cannot wake itself' do
      cheap.escalates_to = cheap
      assert_not cheap.valid?
      assert_includes cheap.errors[:escalates_to], 'cannot be this judge itself'
    end

    it 'cannot close a loop, which would leave every judge in it asleep' do
      top = AiJudge.create!(name: 'Top Judge')
      cheap.update!(escalates_to: expensive)
      expensive.update!(escalates_to: top)

      top.escalates_to = cheap
      assert_not top.valid?
      assert_includes top.errors[:escalates_to], 'would wake a judge that already escalates back to this one'
    end

    it 'forgets the link when the judge it wakes is deleted' do
      cheap.update!(escalates_to: expensive)
      expensive.destroy!

      assert_nil cheap.reload.escalates_to_id
    end
  end
end
