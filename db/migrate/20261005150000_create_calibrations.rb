# frozen_string_literal: true

# Calibration: an AI judge rates a frozen random sample of pairs another
# judge (the reference) has rated, and the two are compared
# (docs/todo/judge_calibration.md C4). Answers are kept apart from
# judgements, so a calibration never moves a rating (C3).
#
# Deleting a book, a pair, or either judge deletes the calibrations that
# depend on it: they can't be read without them.
class CreateCalibrations < ActiveRecord::Migration[8.1]
  def change
    create_samples
    create_sample_pairs
    create_runs
    create_answers
  end

  private

  def create_samples
    create_table :calibration_samples do |t|
      t.references :book, null: false, foreign_key: { on_delete: :cascade }
      t.references :reference, type: :integer, null: false, foreign_key: { to_table: :users, on_delete: :cascade }
      t.references :created_by, type: :integer, null: true, foreign_key: { to_table: :users, on_delete: :nullify }
      # Pairs are inserted in bulk when the sample is drawn, and never change.
      t.integer :pairs_count, null: false, default: 0
      t.timestamps
    end
  end

  def create_sample_pairs
    create_table :calibration_sample_pairs do |t|
      t.references :calibration_sample, null: false, index: false, foreign_key: { on_delete: :cascade }
      t.references :query_doc_pair, null: false, foreign_key: { on_delete: :cascade }
      # The reference's rating when the sample was drawn (C2).
      t.float :reference_rating, null: false
      t.timestamps
      t.index [ :calibration_sample_id, :query_doc_pair_id ], unique: true, name: 'index_calibration_sample_pairs_unique'
    end
  end

  def create_runs
    create_table :calibration_runs do |t|
      t.references :calibration_sample, null: false, foreign_key: { on_delete: :cascade }
      t.references :judge, type: :integer, null: false, foreign_key: { to_table: :users, on_delete: :cascade }
      t.references :created_by, type: :integer, null: true, foreign_key: { to_table: :users, on_delete: :nullify }
      t.string :status, null: false, default: 'queued'
      t.integer :answers_count, null: false, default: 0
      # The judge's prompt and options when the run started.
      t.json :judge_snapshot
      t.text :error
      t.datetime :started_at
      t.datetime :finished_at
      t.timestamps
    end
  end

  def create_answers
    create_table :calibration_answers do |t|
      t.references :calibration_run, null: false, index: false, foreign_key: { on_delete: :cascade }
      t.references :query_doc_pair, null: false, foreign_key: { on_delete: :cascade }
      t.float :rating
      t.boolean :unrateable, null: false, default: false
      t.text :explanation
      t.float :confidence
      t.timestamps
      t.index [ :calibration_run_id, :query_doc_pair_id ], unique: true, name: 'index_calibration_answers_unique'
    end
  end
end
