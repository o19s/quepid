# frozen_string_literal: true

# == Schema Information
#
# Table name: case_metadata
#
#  id             :integer          not null, primary key
#  last_viewed_at :datetime
#  case_id        :integer          not null
#  user_id        :integer          not null
#
# Indexes
#
#  case_metadata_ibfk_1                 (case_id)
#  case_metadata_user_id_case_id_index  (user_id,case_id)
#
# Foreign Keys
#
#  case_metadata_ibfk_1  (case_id => cases.id)
#  case_metadata_ibfk_2  (user_id => users.id)
#

class Metadatum < ApplicationRecord
  self.table_name = 'case_metadata'
  belongs_to :case
  belongs_to :user
end
