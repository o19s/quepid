# frozen_string_literal: true

require 'test_helper'

class BooksHelperTest < ActionView::TestCase
  describe '#available_ai_judges_for_book' do
    it 'returns empty when book has no teams' do
      # Create a book with no teams for this specific test case
      teamless_book = Book.create!(name: 'Teamless Book', scorer: scorers(:valid))
      result = available_ai_judges_for_book(teamless_book)
      assert_empty result
    end

    it 'returns AI judges from book teams that are not already assigned' do
      # Use empty_book which belongs to shared team but has no AI judges assigned
      book = books(:empty_book)
      judge_judy = users(:judge_judy)

      # judge_judy is already a member of the shared team (via fixtures)
      # and empty_book belongs to shared team but has no AI judges assigned
      available_judges = available_ai_judges_for_book(book)
      assert_includes available_judges, judge_judy
    end

    it 'excludes AI judges already assigned to the book' do
      # Use james_bond_movies which already has judge_judy assigned as AI judge
      book = books(:james_bond_movies)
      judge_judy = users(:judge_judy)

      available_judges = available_ai_judges_for_book(book)
      assert_not_includes available_judges, judge_judy
    end

    it 'only returns actual AI judges (users with llm_key)' do
      book = books(:empty_book)
      judge_judy = users(:judge_judy)  # Has llm_key (is AI judge)
      doug = users(:doug)              # Regular user, no llm_key

      # Both are members of shared team, but only judge_judy is AI judge
      available_judges = available_ai_judges_for_book(book)
      assert_includes available_judges, judge_judy
      assert_not_includes available_judges, doug
    end

    it 'returns empty when team has no AI judges' do
      # book_of_comedy_films belongs to another_shared_team which has no AI judges
      book = books(:book_of_comedy_films)

      available_judges = available_ai_judges_for_book(book)
      assert_empty available_judges
    end
  end

  describe '#available_ai_judges_for_book?' do
    it 'returns false when no AI judges are available in team' do
      # book_of_comedy_films belongs to another_shared_team which has no AI judges
      book = books(:book_of_comedy_films)
      assert_not available_ai_judges_for_book?(book)
    end

    it 'returns false when book has no teams' do
      teamless_book = Book.create!(name: 'Teamless Book', scorer: scorers(:valid))
      assert_not available_ai_judges_for_book?(teamless_book)
    end

    it 'returns true when AI judges are available' do
      # Use empty_book which has shared team with judge_judy but no AI judges assigned
      book = books(:empty_book)
      assert available_ai_judges_for_book?(book)
    end

    it 'returns false when all team AI judges are already assigned' do
      # james_bond_movies already has judge_judy assigned
      book = books(:james_bond_movies)
      assert_not available_ai_judges_for_book?(book)
    end
  end
end
