# frozen_string_literal: true

# How a book merges the judgements on a query/doc pair into the rating cases read (ADR 0007).
# quepid_classic is the rule every book used before this column existed.
class AddJudgementMergingToBooks < ActiveRecord::Migration[8.1]
  def change
    add_column :books, :judgement_merge_rule, :string, null: false, default: 'quepid_classic'
    add_column :books, :judgement_merge_tiers, :text
  end
end
