# frozen_string_literal: true

# == Schema Information
#
# Table name: annotations
#
#  id         :integer          not null, primary key
#  message    :text(16777215)
#  source     :string(255)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  user_id    :integer
#
# Indexes
#
#  index_annotations_on_user_id  (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (user_id => users.id)
#

class Annotation < ApplicationRecord
  # Associations
  belongs_to  :user, optional: false
  has_one     :score, dependent: :destroy
  has_one     :case, through: :score

  default_scope -> { order(updated_at: :desc) }
end
