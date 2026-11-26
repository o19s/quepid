# frozen_string_literal: true

require 'test_helper'

class JudgementMergingHelperTest < ActionView::TestCase
  it 'describes every rule the book model knows' do
    assert_equal Book.judgement_merge_rules.keys.sort, JudgementMergingHelper::JUDGEMENT_MERGE_RULES.keys.sort
  end

  it 'summarises the rule and the tiers' do
    assert_equal 'Every judge counts. Combined by Quepid classic', judgement_merge_summary(Book.new)
    assert_equal 'Human judges first: AI judges count only when no human has judged. Combined by Mean',
                 judgement_merge_summary(Book.new(judgement_merge_rule: 'mean', judgement_merge_tiers: %w[human ai]))
  end

  it 'offers tiers set outside the form as a choice' do
    book = Book.new(judgement_merge_tiers: %w[anonymous human])

    assert_includes judgement_merge_tier_options(book), [ 'Precedence: anonymous judges, then human judges', 'anonymous,human' ]
    assert_equal 'Precedence: anonymous judges, then human judges. Combined by Median',
                 judgement_merge_summary(Book.new(judgement_merge_rule: 'median', judgement_merge_tiers: %w[anonymous human]))
  end
end
