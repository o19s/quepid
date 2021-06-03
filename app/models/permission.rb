# frozen_string_literal: true

# == Schema Information
#
# Table name: permissions
#
#  id         :integer          not null, primary key
#  user_id    :integer
#  model_type :string(255)      not null
#  action     :string(255)      not null
#  on         :boolean          default(FALSE)
#  created_at :datetime         not null
#  updated_at :datetime         not null
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
