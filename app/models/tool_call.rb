# frozen_string_literal: true

# == Schema Information
#
# Table name: tool_calls
#
#  id                :bigint           not null, primary key
#  arguments         :json
#  name              :string(255)      not null
#  thought_signature :text(65535)
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  message_id        :bigint           not null
#  tool_call_id      :string(255)      not null
#
# Indexes
#
#  index_tool_calls_on_message_id    (message_id)
#  index_tool_calls_on_name          (name)
#  index_tool_calls_on_tool_call_id  (tool_call_id) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (message_id => messages.id)
#
class ToolCall < ApplicationRecord
  acts_as_tool_call
end
