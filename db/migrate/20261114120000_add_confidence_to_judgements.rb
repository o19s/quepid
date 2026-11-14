# frozen_string_literal: true

# How sure the judge was of this judgement's rating, from 0 to 1, as the judge reported it
# (ADR 0008). NULL means the judge reported none -- never 0, and never stored as 1.
class AddConfidenceToJudgements < ActiveRecord::Migration[8.1]
  def change
    add_column :judgements, :confidence, :float
  end
end
