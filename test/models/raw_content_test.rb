# == Schema Information
#
# Table name: raw_contents
#
#  id         :bigint           not null, primary key
#  content    :text(65535)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  try_id     :integer
#
require "test_helper"

class RawContentTest < ActiveSupport::TestCase
  # test "the truth" do
  #   assert true
  # end
end
