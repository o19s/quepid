# frozen_string_literal: true

# app/models/web_request.rb
# == Schema Information
#
# Table name: web_requests
#
#  id                :bigint           not null, primary key
#  integer           :integer
#  request           :binary(65535)
#  response          :binary(429496729
#  response_status   :integer
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  snapshot_query_id :integer
#
class WebRequest < ApplicationRecord
  belongs_to :snapshot_query, optional: true
end
