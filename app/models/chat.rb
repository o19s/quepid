# frozen_string_literal: true

# == Schema Information
#
# Table name: chats
#
#  id         :bigint           not null, primary key
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  model_id   :bigint
#
# Indexes
#
#  index_chats_on_model_id  (model_id)
#
# Foreign Keys
#
#  fk_rails_...  (model_id => models.id)
#
class Chat < ApplicationRecord
  acts_as_chat
end
