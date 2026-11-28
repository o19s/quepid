# frozen_string_literal: true

require 'test_helper'

class TurnOffUnchosenJevImagesMigrationTest < ActiveSupport::TestCase
  test 'turns images off on Jev judges and leaves every other judge alone' do
    jev_on = judge('typesafe_jev', llm_include_images: 'true')
    jev_unset = judge('typesafe_jev')
    openai_on = judge('openai', llm_include_images: 'true')
    ollama_on = judge('ollama', llm_include_images: 'true')

    migrate

    assert_equal 'false', jev_on.reload.judge_options[:llm_include_images]
    assert_equal 'false', jev_unset.reload.judge_options[:llm_include_images]
    assert_equal 'true', openai_on.reload.judge_options[:llm_include_images]
    assert_equal 'true', ollama_on.reload.judge_options[:llm_include_images]
  end

  test 'keeps the rest of a Jev judge options' do
    jev = judge('typesafe_jev', llm_include_images: 'true', jev_min_confidence: '0.4', llm_model: 'jev-1.14.0')

    migrate

    assert_equal({ llm_provider: 'typesafe_jev', llm_include_images: 'false', jev_min_confidence: '0.4', llm_model: 'jev-1.14.0' },
                 jev.reload.judge_options)
  end

  private

  def judge provider, **options
    AiJudge.create!(name: "#{provider} judge", judge_options: { llm_provider: provider }.merge(options))
  end

  def migrate
    require Rails.root.join('db/migrate/20261128120000_turn_off_unchosen_jev_images.rb')
    ActiveRecord::Migration.suppress_messages { TurnOffUnchosenJevImages.new.up }
  end
end
