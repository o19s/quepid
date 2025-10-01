# frozen_string_literal: true

require 'test_helper'


class JudgementHelperTest < ActionView::TestCase
  test "calculate_button_class returns correct button classes" do
      # Test with max_score = 10
      assert_equal "btn-danger", calculate_button_class(0, 10)
      assert_equal "btn-warning", calculate_button_class(2, 10)
      assert_equal "btn-info", calculate_button_class(5, 10)
      assert_equal "btn-success", calculate_button_class(8, 10)
      
      # Test with different max_score
      assert_equal "btn-danger", calculate_button_class(0, 4)
      assert_equal "btn-warning", calculate_button_class(1, 4)
      assert_equal "btn-info", calculate_button_class(2, 4)
      assert_equal "btn-success", calculate_button_class(3, 4)
    end
    
    test "calculate_keyboard_key returns correct keys" do
      # Test different scores
      assert_equal({ name: "a", display_name: "A" }, calculate_keyboard_key(0))
      assert_equal({ name: "s", display_name: "S" }, calculate_keyboard_key(1))
      assert_equal({ name: "d", display_name: "D" }, calculate_keyboard_key(2))
      
      # Test scores above 9 (should be capped)
      assert_equal({ name: "sc", display_name: "SC" }, calculate_keyboard_key(9))
      assert_equal({ name: "sc", display_name: "SC" }, calculate_keyboard_key(10))
      
      # Test handling of string scores
      assert_equal({ name: "a", display_name: "A" }, calculate_keyboard_key("0"))
      assert_equal({ name: "s", display_name: "S" }, calculate_keyboard_key("1"))
      
    end
    
    test "calculate_hsl_color generates colors matching Angular app" do
      # Test with scale [0, 1, 2, 3]
      scale = [0, 1, 2, 3]
      
      # Min score (0) should be red (hue 0)
      assert_equal "hsl(0, 100%, 50%)", calculate_hsl_color(0, scale)
      
      # Max score (3) should be green (hue 120)
      assert_equal "hsl(120, 100%, 50%)", calculate_hsl_color(3, scale)
      
      # Middle scores should be proportional
      assert_equal "hsl(40, 100%, 50%)", calculate_hsl_color(1, scale)
      assert_equal "hsl(80, 100%, 50%)", calculate_hsl_color(2, scale)
      
      # Test with different scale [1, 2, 3, 4, 5]
      scale2 = [1, 2, 3, 4, 5]
      
      # Min score (1) should be red (hue 0)
      assert_equal "hsl(0, 100%, 50%)", calculate_hsl_color(1, scale2)
      
      # Max score (5) should be green (hue 120)
      assert_equal "hsl(120, 100%, 50%)", calculate_hsl_color(5, scale2)
      
      # Edge case: single value scale should default to hue 0
      single_scale = [5, 5]
      assert_equal "hsl(0, 100%, 50%)", calculate_hsl_color(5, single_scale)
    end
end
