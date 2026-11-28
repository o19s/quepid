# frozen_string_literal: true

# Jev judges could not take images, and the AI Judge form's hidden field still saved
# llm_include_images "true" for them -- a value nobody chose. Now that Jev takes images and they
# are opt-in for it (ADR 0009 D1, D9), those judges would start sending them. Turn them off.
# Iterated in Ruby, not a JSON query, because the app runs on MySQL and PostgreSQL.
class TurnOffUnchosenJevImages < ActiveRecord::Migration[8.1]
  class User < ActiveRecord::Base
    self.table_name = 'users'
    self.inheritance_column = nil
  end

  def up
    User.where(type: 'AiJudge').where.not(options: nil).find_each do |judge|
      judge_options = judge.options.to_h['judge_options']
      next unless judge_options.is_a?(Hash) && 'typesafe_jev' == judge_options['llm_provider']
      next if 'false' == judge_options['llm_include_images']

      judge.update_column(:options, judge.options.merge('judge_options' => judge_options.merge('llm_include_images' => 'false')))
    end
  end

  def down
    # Before this the switch was disabled for Jev, so no stored value was a real choice.
  end
end
