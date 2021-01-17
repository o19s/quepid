# frozen_string_literal: true

# == Schema Information
#
# Table name: case_metadata
#
#  id             :integer          not null, primary key
#  user_id        :integer          not null
#  case_id        :integer          not null
#  last_viewed_at :datetime
#

class Metadatum < ApplicationRecord
  self.table_name = 'case_metadata'
  belongs_to :case
  belongs_to :user
end
