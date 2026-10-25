# frozen_string_literal: true

require 'test_helper'

class HomeHelperTest < ActionView::TestCase
  test 'greeting returns one of the known greeting strings' do
    known_greetings = [
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

    assert_includes known_greetings, greeting
  end
end
