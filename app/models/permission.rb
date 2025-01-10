# frozen_string_literal: true

# == Schema Information
#
# Table name: permissions
#
#  id         :integer          not null, primary key
#  action     :string(255)      not null
#  model_type :string(255)      not null
#  on         :boolean          default(FALSE)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  user_id    :integer
#
# Indexes
#
#  index_permissions_user_id  (user_id)
#

class Permission < ApplicationRecord
  # Associations
  belongs_to :user

  # Validations
  validates :model_type,
            presence: true

  validates :action,
            presence: true
end
