# frozen_string_literal: true

# An AI judge can name a second judge to wake when it is unsure of an answer
# (docs/todo/escalating_judges.md). users.id is a plain integer, so the
# reference is too.
class AddEscalatesToIdToUsers < ActiveRecord::Migration[8.1]
  def change
    add_reference :users, :escalates_to, type: :integer, null: true, index: true,
                                         foreign_key: { to_table: :users, on_delete: :nullify }
  end
end
