# frozen_string_literal: true

require 'test_helper'

class ApplicationHelperTest < ActionView::TestCase
  test 'adds space when cell begins with =' do
    assert_equal ' =abc', make_csv_safe('=abc')
  end

  test 'adds space when cell begins with +' do
    assert_equal ' +abc', make_csv_safe('+abc')
  end

  test 'adds space when cell begins with -' do
    assert_equal ' -abc', make_csv_safe('-abc')
  end

  test 'adds space when cell begins with @' do
    assert_equal ' @abc', make_csv_safe('@abc')
  end

  test 'other strings unchanged' do
    assert_equal 'ab=@c', make_csv_safe('ab=@c')
  end
end
