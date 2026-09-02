# frozen_string_literal: true

require 'test_helper'

class HomeHelperTest < ActionView::TestCase
  include ActiveSupport::Testing::TimeHelpers

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

  test 'greeting2 returns Good Morning between midnight and noon' do
    travel_to Time.zone.local(2026, 1, 1, 9, 0, 0) do
      assert_equal 'Good Morning', greeting2
    end
  end

  test 'greeting2 returns Good Afternoon between noon and 5pm' do
    travel_to Time.zone.local(2026, 1, 1, 14, 0, 0) do
      assert_equal 'Good Afternoon', greeting2
    end
  end

  test 'greeting2 returns Good Evening between 5pm and 8pm' do
    travel_to Time.zone.local(2026, 1, 1, 18, 0, 0) do
      assert_equal 'Good Evening', greeting2
    end
  end

  test 'greeting2 returns Good Night between 8pm and midnight' do
    travel_to Time.zone.local(2026, 1, 1, 22, 0, 0) do
      assert_equal 'Good Night', greeting2
    end
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
