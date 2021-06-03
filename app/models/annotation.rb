# frozen_string_literal: true

# == Schema Information
#
# Table name: annotations
#
#  id         :integer          not null, primary key
#  message    :text(65535)
#  source     :string(255)
#  user_id    :integer
#  created_at :datetime         not null
#  updated_at :datetime         not null
#

class Annotation < ApplicationRecord
  # Associations
  belongs_to  :user, optional: false
  has_one     :score, dependent: :destroy
  has_one     :case, through: :score

  default_scope -> { order(updated_at: :desc) }
end
