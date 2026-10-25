# frozen_string_literal: true

require 'test_helper'

class TextSearchTest < ActiveSupport::TestCase
  test 'literal wildcard characters do not broaden searches' do
    kase = cases(:random_case)
    kase.update!(case_name: 'Literal 50%_offer')
    assert_includes Case.search_by('50%_', :case_name), kase
    assert_not_includes Case.search_by('50%X', :case_name), kase
    assert_includes Case.search_by('LITERAL', :case_name), kase
    assert_includes Case.search_by('offer', 'cases.case_name'), kase
  end
end
