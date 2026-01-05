# frozen_string_literal: true

require 'test_helper'

class HomeControllerTest < ActionDispatch::IntegrationTest
  test 'should get redirected to log in' do
    get root_url
    assert_response :redirect
  end

  test 'can I group things' do
    case_names = [ 'Typeahead: Dairy', 'Typeahead: Meats', 'Typeahead: Dessert', 'Typeahead: Fruit & Veg',
                   'Global Search', 'Nested:Search:IsFun' ]

    grouped_names = case_names.group_by { |name| name.split(':').first }

    assert_not_nil grouped_names['Typeahead']
    assert_equal 4, grouped_names['Typeahead'].count
    assert_not_nil grouped_names['Global Search']
    assert_equal 1, grouped_names['Global Search'].count
    assert_not_nil grouped_names['Nested']
    assert_equal 1, grouped_names['Nested'].count
  end
end
