# frozen_string_literal: true

# == Schema Information
#
# Table name: default_scorers
#
#  id                     :integer          not null, primary key
#  code                   :text(65535)
#  name                   :string(255)
#  scale                  :string(255)
#  manual_max_score       :boolean          default(FALSE)
#  manual_max_score_value :integer
#  show_scale_labels      :boolean          default(FALSE)
#  scale_with_labels      :text(65535)
#  state                  :string(255)      default("draft")
#  published_at           :datetime
#  default                :boolean          default(FALSE)
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#

require 'test_helper'

class DefaultScorerTest < ActiveSupport::TestCase
  # test "the truth" do
  #   assert true
  # end
end
