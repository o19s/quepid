# frozen_string_literal: true

# A judgement an on-call judge made because another judge's answer was
# unrateable points back at that answer (docs/todo/escalating_judges.md D2).
# Unique: an unrateable judgement is escalated at most once.
class AddEscalatedFromIdToJudgements < ActiveRecord::Migration[8.1]
  def change
    add_reference :judgements, :escalated_from, null:        true,
                                                index:       { unique: true },
                                                foreign_key: { to_table: :judgements, on_delete: :nullify }
  end
end
