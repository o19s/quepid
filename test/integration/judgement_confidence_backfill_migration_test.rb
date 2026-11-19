# frozen_string_literal: true

require 'test_helper'

class JudgementConfidenceBackfillMigrationTest < ActiveSupport::TestCase
  JEV = 'Jev rated 1 ("Relevant") -- raw score 0.57 of 0-1, confidence 0.35. Distribution: 0: 43%, 1: 57%. (model jev-1)'

  setup do
    @pair = query_doc_pairs(:one)
  end

  test 'reads Jev confidence back from the explanation, and nothing else' do
    jev = judgement(users(:random), JEV)
    choice = judgement(users(:doug), 'Jev rated 7 -- confidence 0.8. Distribution: 7: 80%, 2: 20%. (model jev-1)')
    unknown = judgement(users(:matt), 'Jev rated 1 -- raw score 1 of 0-1, confidence unknown. Distribution: not reported. (model jev-1)')
    chat = judgement(users(:joe), 'Looks relevant, confidence 0.9. Distribution: no.')
    quoting = judgement(users(:judge_judy), "Escalated from jev, whose answer was unrateable: #{JEV}\n\nThe document is about laws.")

    migrate

    assert_in_delta 0.35, jev.reload.confidence
    assert_in_delta 0.8, choice.reload.confidence
    assert_nil unknown.reload.confidence
    assert_nil chat.reload.confidence
    assert_nil quoting.reload.confidence, "the note quotes another judgement's confidence"
  end

  test 'an escalated Jev judgement is read after its escalation note, even once its source is gone' do
    source = judgement(users(:random), 'some judge was unsure', rating: nil, unrateable: true)
    linked = judgement(users(:doug), "Escalated from someone, whose answer was unrateable: confidence 0.1.\n\n#{JEV}")
    linked.update_column(:escalated_from_judgement_id, source.id)
    orphaned = judgement(users(:matt), "Escalated from someone, whose answer was unrateable: confidence 0.1.\n\n#{JEV}")

    migrate

    assert_in_delta 0.35, linked.reload.confidence
    assert_in_delta 0.35, orphaned.reload.confidence
  end

  private

  def judgement user, explanation, rating: 1, unrateable: false
    @pair.judgements.where(user: user).delete_all
    record = @pair.judgements.create!(user: user, rating: rating, unrateable: unrateable)
    record.update_column(:explanation, explanation)
    record
  end

  def migrate
    require Rails.root.join('db/migrate/20261114120100_backfill_judgement_confidence_from_jev_explanations.rb')
    ActiveRecord::Migration.suppress_messages { BackfillJudgementConfidenceFromJevExplanations.new.up }
  end
end
