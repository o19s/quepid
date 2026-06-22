# frozen_string_literal: true

# == Schema Information
#
# Table name: messages
#
#  id                    :bigint           not null, primary key
#  cache_creation_tokens :integer
#  cached_tokens         :integer
#  content               :text(65535)
#  content_raw           :json
#  input_tokens          :integer
#  output_tokens         :integer
#  role                  :string(255)      not null
#  thinking_signature    :text(65535)
#  thinking_text         :text(65535)
#  thinking_tokens       :integer
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  chat_id               :bigint           not null
#  model_id              :bigint
#  tool_call_id          :bigint
#
# Indexes
#
#  index_messages_on_chat_id       (chat_id)
#  index_messages_on_model_id      (model_id)
#  index_messages_on_role          (role)
#  index_messages_on_tool_call_id  (tool_call_id)
#
# Foreign Keys
#
#  fk_rails_...  (chat_id => chats.id)
#  fk_rails_...  (model_id => models.id)
#  fk_rails_...  (tool_call_id => tool_calls.id)
#
class Message < ApplicationRecord
  acts_as_message
  has_many_attached :attachments
end
