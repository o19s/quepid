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
  end
end
