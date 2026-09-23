# frozen_string_literal: true

require 'test_helper'

class BooksHelperTest < ActionView::TestCase
  describe '#available_ai_judges_for_book' do
    it 'returns AI judges the viewing user can see via a shared team, not already assigned' do
      # empty_book is owned by doug, who shares the "shared" team with judge_judy
      book = books(:empty_book)
      doug = users(:doug)
      judge_judy = users(:judge_judy)

      available_judges = available_ai_judges_for_book(book, doug)
      assert_includes available_judges, judge_judy
    end

    it 'excludes AI judges already assigned to the book' do
      # Use james_bond_movies which already has judge_judy assigned as AI judge
      book = books(:james_bond_movies)
      doug = users(:doug)
      judge_judy = users(:judge_judy)

      available_judges = available_ai_judges_for_book(book, doug)
      assert_not_includes available_judges, judge_judy
    end

    it 'only returns actual AI judges (users with llm_key)' do
      book = books(:empty_book)
      doug = users(:doug)
      judge_judy = users(:judge_judy) # Has llm_key (is AI judge)

      # Both are members of shared team, but only judge_judy is AI judge
      available_judges = available_ai_judges_for_book(book, doug)
      assert_includes available_judges, judge_judy
      assert_not_includes available_judges, doug
    end

    it 'returns judges visible to the viewer even when the book has no owner' do
      # book_of_star_wars_judgements has no owner - availability must come
      # from the *viewer's* own access, not the book's ownership.
      ownerless_book = books(:book_of_star_wars_judgements)
      doug = users(:doug)
      judge_judy = users(:judge_judy)

      available_judges = available_ai_judges_for_book(ownerless_book, doug)
      assert_includes available_judges, judge_judy
    end

    it "returns empty when the viewing user has no access to any AI judge, even via the book's own team" do
      # Guards against reverting to the pre-ownership-model bug: availability
      # must come from the *viewer's* access, not the book's own team
      # membership - case_finder_user isn't on the "shared" team (which has
      # judge_judy), so judge_judy must not appear for them here even though
      # book_of_star_wars_judgements itself is shared with that team.
      book = books(:book_of_star_wars_judgements)
      case_finder_user = users(:case_finder_user)

      available_judges = available_ai_judges_for_book(book, case_finder_user)
      assert_empty available_judges
    end
  end

  describe '#available_ai_judges_for_book?' do
    it 'returns false when the viewing user has no AI judge access' do
      book = books(:book_of_star_wars_judgements)
      case_finder_user = users(:case_finder_user)

      assert_not available_ai_judges_for_book?(book, case_finder_user)
    end

    it 'returns true when AI judges are available' do
      # empty_book is owned by doug, who shares the "shared" team with judge_judy
      book = books(:empty_book)
      doug = users(:doug)
      assert available_ai_judges_for_book?(book, doug)
    end

    it 'returns false when all team AI judges are already assigned' do
      # james_bond_movies already has judge_judy assigned
      book = books(:james_bond_movies)
      doug = users(:doug)
      assert_not available_ai_judges_for_book?(book, doug)
    end
  end

  describe '#scorer_scale_lengths' do
    it 'returns a hash mapping scorer ids to scale lengths' do
      user = users(:doug)
      result = scorer_scale_lengths(user)

      assert_instance_of Hash, result
      # Each value should be an integer representing scale length
      result.each_value do |length|
        assert_instance_of Integer, length
      end
    end

    it 'correctly identifies 4-point scales' do
      user = users(:doug)
      # Find a scorer with a 4-point scale
      scorer = user.scorers_involved_with.find { |s| 4 == s.scale&.length }
      skip 'No 4-point scale scorer found for test user' unless scorer

      result = scorer_scale_lengths(user)
      assert_equal 4, result[scorer.id]
    end
  end
end
