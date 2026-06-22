class AddReferencesToChatsToolCallsAndMessages < ActiveRecord::Migration[8.1]
  def change
    add_reference :chats, :model, foreign_key: true
    add_reference :tool_calls, :message, null: false, foreign_key: true
    add_reference :messages, :chat, null: false, foreign_key: true
    add_reference :messages, :model, foreign_key: true
    add_reference :messages, :tool_call, foreign_key: true
  end
end
