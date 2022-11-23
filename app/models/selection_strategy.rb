# == Schema Information
#
# Table name: selection_strategies
#
#  id         :bigint           not null, primary key
#  name       :string(255)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
class SelectionStrategy < ApplicationRecord
end
