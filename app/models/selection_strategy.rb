# frozen_string_literal: true

# SelectionStrategy module provides functionality for selecting query-document pairs
# to be judged. This implementation supports only the "Multiple Raters" strategy,
# which allows up to three ratings for each query/doc pair.
module SelectionStrategy
  # Returns whether more judgements are needed for the given book
  # Under the Multiple Raters strategy, we need up to 3 judgements per query/doc pair
  def self.moar_judgements_needed? book
    !every_query_doc_pair_has_three_judgements?(book)
  end

  # Randomly selects a query-document pair that needs judging for the given user
  # Uses position-weighted randomization to prioritize higher-ranked documents
  # Only selects pairs where:
  # - The user hasn't already judged this pair
  # - The pair has fewer than 3 total judgements
  def self.random_query_doc_based_on_strategy book, user
    random_query_doc_pair_for_multiple_judges(book, user)
  end

  # Checks if the given user has judged all available query-document pairs
  # Returns true if the user has no more pairs available to judge
  def self.user_has_judged_all_available_pairs? book, user
    random_query_doc_pair_for_multiple_judges(book, user).nil?
  end

  # Returns true if there are query-doc pairs with zero judgements (highest priority)
  def self.unjudged_pairs? book
    book.query_doc_pairs
      .left_joins(:judgements)
      .group('query_doc_pairs.id')
      .having('COUNT(judgements.id) = 0')
      .exists?
  end

  # Returns count of query-doc pairs with no judgements
  def self.unjudged_pairs_count book
    book.query_doc_pairs
      .left_joins(:judgements)
      .group('query_doc_pairs.id')
      .having('COUNT(judgements.id) = 0')
      .count.size
  end

  # Returns count of query-doc pairs with 1-2 judgements (partially judged)
  def self.partially_judged_pairs_count book
    book.query_doc_pairs
      .left_joins(:judgements)
      .group('query_doc_pairs.id')
      .having('COUNT(judgements.id) BETWEEN 1 AND 2')
      .count.size
  end

  # Checks if every query-document pair in the book has at least 3 judgements
  def self.every_query_doc_pair_has_three_judgements? book
    query_doc_pair = book.query_doc_pairs
      .left_joins(:judgements)
      .group('query_doc_pairs.id')
      .having('COUNT(judgements.id) < 3')
      .first
    query_doc_pair.nil? # if we didn't find a match, then return true
  end

  # Randomly selects a query-doc pair for multiple judges strategy
  # - Ensures the current user hasn't judged this pair yet
  # - Ensures the pair has fewer than 3 total judgements
  # - Uses position-weighted randomization (higher positions are more likely to be selected)
  # - missing position value query doc pairs are pushed down and less likely to be selected
  def self.random_query_doc_pair_for_multiple_judges book, user
    book.query_doc_pairs
      .left_joins(:judgements)
      .group('query_doc_pairs.id')
      .having('COUNT(CASE WHEN judgements.user_id = ? THEN 1 END) = 0', user.id)
      .having('COUNT(judgements.id) < 3')
      .order(Arel.sql('-LOG(1.0 - RAND()) * (COALESCE(position, 1000) + 1)'))
      .first
  end
end
