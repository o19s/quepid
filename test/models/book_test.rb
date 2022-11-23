# == Schema Information
#
# Table name: books
#
#  id                    :bigint           not null, primary key
#  name                  :string(255)
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  scorer_id             :integer
#  selection_strategy_id :bigint           not null
#  team_id               :integer
#
# Indexes
#
#  index_books_on_selection_strategy_id  (selection_strategy_id)
#
# Foreign Keys
#
#  fk_rails_...  (selection_strategy_id => selection_strategies.id)
#
require "test_helper"

class BookTest < ActiveSupport::TestCase
  # test "the truth" do
  #   assert true
  # end
end
