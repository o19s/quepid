# frozen_string_literal: true

# How a book's judgement merging (Book#judgement_merge_rule and #judgement_merge_tiers) is
# named and offered in the book form, the book page and the case's book picker.
module JudgementMergingHelper
  # Name and one-line description of each Book.judgement_merge_rules value.
  JUDGEMENT_MERGE_RULES = {
    'quepid_classic' => [ 'Quepid classic', 'One or two judgements are averaged; with three or more, the lowest of the three highest ratings.' ],
    'mean'           => [ 'Mean', 'The average of the ratings.' ],
    'median'         => [ 'Median', 'The middle rating; with an even count, the average of the two middle ones.' ],
    'min'            => [ 'Minimum', 'The lowest rating.' ],
    'max'            => [ 'Maximum', 'The highest rating.' ],
    'majority'       => [ 'Majority', 'The most common rating; a tie falls back to the median.' ],
    'first'          => [ 'First', 'The rating of the earliest judgement on the pair.' ],
  }.freeze

  # Precedence choices the book form offers, as Book#judgement_merge_tier_list values.
  JUDGEMENT_MERGE_TIER_CHOICES = {
    ''         => 'Every judge counts',
    'human,ai' => 'Human judges first: AI judges count only when no human has judged',
    'ai,human' => 'AI judges first: humans count only when no AI judge has judged',
  }.freeze

  def judgement_merge_rule_options
    Book.judgement_merge_rules.keys.map { |rule| [ JUDGEMENT_MERGE_RULES.dig(rule, 0) || rule.humanize, rule ] }
  end

  # The book's current tiers are always offered, even when set through the API to a list
  # the form does not have.
  def judgement_merge_tier_options book
    choices = JUDGEMENT_MERGE_TIER_CHOICES.invert.to_a
    current = book.judgement_merge_tier_list
    choices << [ judgement_merge_tiers_description(book), current ] unless JUDGEMENT_MERGE_TIER_CHOICES.key?(current)
    choices
  end

  def judgement_merge_tiers_description book
    JUDGEMENT_MERGE_TIER_CHOICES[book.judgement_merge_tier_list] ||
      "Precedence: #{book.judgement_merge_tiers.map { |kind| "#{'ai' == kind ? 'AI' : kind} judges" }.join(', then ')}"
  end

  # One line saying how a book turns its judgements into case ratings, judges first, e.g.
  # "Human judges first: AI judges count only when no human has judged. Combined by Mean".
  def judgement_merge_summary book
    rule = JUDGEMENT_MERGE_RULES.dig(book.judgement_merge_rule, 0) || book.judgement_merge_rule.humanize
    "#{judgement_merge_tiers_description(book)}. Combined by #{rule}"
  end
end
