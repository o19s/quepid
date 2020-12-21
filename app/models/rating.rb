# frozen_string_literal: true

# == Schema Information
#
# Table name: ratings
#
#  id         :integer          not null, primary key
#  doc_id     :string(500)
#  rating     :integer
#  query_id   :integer
#  user_id   :integer
#  created_at :datetime         not null
#  updated_at :datetime         not null
#

class Rating < ApplicationRecord
  belongs_to :query
  belongs_to :user, optional: true
end
