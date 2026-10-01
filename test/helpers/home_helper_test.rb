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

  test 'strip_case_title removes a leading Case prefix and titleizes the rest' do
    kase = cases(:case_with_one_try)

    assert_equal 'With One Try', strip_case_title(kase)
  end

  test 'strip_case_title titleizes a case name without a leading Case prefix' do
    kase = cases(:one)

    assert_equal 'One', strip_case_title(kase)
  end
end
