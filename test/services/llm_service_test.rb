# frozen_string_literal: true

require 'test_helper'

class LlmServiceTest < ActiveSupport::TestCase
  let(:user)    { users(:judge_judy) }
  let(:service) { LlmService.new user.openai_key, {} }
  

  let(:score_data) do
    {
      all_rated:  [ true, false ].sample,
      queries:    {},
      score:      (1..100).to_a.sample,
      try_number: the_try.try_number,
      user_id:    user.id,
    }
  end

  describe 'Hacking with Scott' do
    test 'can we make it run' do
      WebMock.allow_net_connect!
      user_prompt = 'Explain why you chose a judgment of 3.'
      system_prompt = 'Provide a JSON response with an explanation and a judgment value.'
      result = service.get_llm_response(user_prompt, system_prompt)
      puts result

      assert_equal 3, result[:judgment]

      WebMock.disable_net_connect!
    end
  end
end
