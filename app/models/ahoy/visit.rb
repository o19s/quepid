# frozen_string_literal: true

# == Schema Information
#
# Table name: ahoy_visits
#
#  id               :bigint           not null, primary key
#  app_version      :string(255)
#  browser          :string(255)
#  city             :string(255)
#  country          :string(255)
#  device_type      :string(255)
#  ip               :string(255)
#  landing_page     :text(65535)
#  latitude         :float(24)
#  longitude        :float(24)
#  os               :string(255)
#  os_version       :string(255)
#  platform         :string(255)
#  referrer         :text(65535)
#  referring_domain :string(255)
#  region           :string(255)
#  started_at       :datetime
#  user_agent       :text(65535)
#  utm_campaign     :string(255)
#  utm_content      :string(255)
#  utm_medium       :string(255)
#  utm_source       :string(255)
#  utm_term         :string(255)
#  visit_token      :string(255)
#  visitor_token    :string(255)
#  user_id          :bigint
#
# Indexes
#
#  index_ahoy_visits_on_user_id                       (user_id)
#  index_ahoy_visits_on_visit_token                   (visit_token) UNIQUE
#  index_ahoy_visits_on_visitor_token_and_started_at  (visitor_token,started_at)
#
module Ahoy
  class Visit < ApplicationRecord
    self.table_name = 'ahoy_visits'

    has_many :events, class_name: 'Ahoy::Event', dependent: :destroy
    belongs_to :user, optional: true
  end
end
