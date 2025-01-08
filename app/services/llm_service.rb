# frozen_string_literal: true

class LlmService
  def initialize openai_key, _opts = {}
    @openai_key = openai_key
  end

  def make_judgement _system_prompt, _user_prompt
    {
      explanation: 'Hi scott',
      rating:      rand(4),
    }
  end
end
