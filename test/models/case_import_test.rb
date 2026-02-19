# frozen_string_literal: true

# == Schema Information
#
# Table name: case_imports
#
#  id            :bigint           not null, primary key
#  import_params :json
#  status        :string(255)
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#  case_id       :integer          not null
#  user_id       :integer          not null
#
# Indexes
#
#  index_case_imports_on_case_id  (case_id)
#  index_case_imports_on_user_id  (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (case_id => cases.id)
#  fk_rails_...  (user_id => users.id)
#
require 'test_helper'

class CaseImportTest < ActiveSupport::TestCase
  # test "the truth" do
  #   assert true
  # end
end
