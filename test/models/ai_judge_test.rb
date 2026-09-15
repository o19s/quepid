# frozen_string_literal: true

require 'test_helper'

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

    it 'requires an llm_key' do
      judge = AiJudge.new(name: 'Judge Judy')
      assert_not judge.valid?
      judge.llm_key = '1234'
      assert_predicate judge, :valid?
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
