# frozen_string_literal: true

module HomeHelper
  def greeting
    greetings = [
      "G'Day",
      'Hello',
      "How's your day?",
      'Good to see you',
      'So good to see you',
      'Hiya!',
      'Bonjour',
      'Hola!',
      'こんにちは',
      '你好',
      'नमस्ते',
      'Guten Tag'
    ]
    greetings.sample
  end

  def strip_case_title kase
    kase.case_name.sub(/^case\s+/i, '').titleize
  end
end
