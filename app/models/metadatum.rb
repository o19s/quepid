# frozen_string_literal: true

# == Schema Information
#
# Table name: case_metadata
#
#  id             :integer          not null, primary key
#  user_id        :integer          not null
#  case_id        :integer          not null
#  last_viewed_at :datetime
#  ratings_view   :integer
#

class Metadatum < ApplicationRecord
  self.table_name = 'case_metadata'
  belongs_to :case
  belongs_to :user

  enum ratings_view: { consolidated: 0, individual: 1 }, _suffix: true

  after_initialize do |c|
    c.individual_ratings_view! if ratings_view.nil?
  end
end
