# frozen_string_literal: true

require 'test_helper'

class BooksHelperTest < ActionView::TestCase
  describe '#available_ai_judges_for_book' do
    it 'returns empty when book has no owner' do
      # Create a book with no owner for this specific test case
      ownerless_book = Book.create!(name: 'Ownerless Book')
      result = available_ai_judges_for_book(ownerless_book)
      assert_empty result
    end

    it "returns AI judges the book's owner can see via a shared team, not already assigned" do
      # empty_book is owned by doug, who shares the "shared" team with judge_judy
      book = books(:empty_book)
      judge_judy = users(:judge_judy)

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

    it 'returns empty when the book has no owner even if its team has AI judges' do
      # "shared" team has judge_judy as a member - if this method looked at the
      # book's own teams (the pre-ownership-model behavior) rather than the
      # book's owner, it would find her here despite the book having no owner.
      shared_team = teams(:shared)
      book = Book.create!(name: 'Ownerless Book On A Judge Team', teams: [ shared_team ])

      available_judges = available_ai_judges_for_book(book)
      assert_empty available_judges
    end
  end

  describe '#available_ai_judges_for_book?' do
    it 'returns false when the book has no owner' do
      ownerless_book = Book.create!(name: 'Ownerless Book')
      assert_not available_ai_judges_for_book?(ownerless_book)
    end

    it 'returns false when the book has no owner even if its team has AI judges' do
      # Same regression this guards against as the #available_ai_judges_for_book
      # test above: ownership, not the book's own team membership, must decide.
      shared_team = teams(:shared)
      book = Book.create!(name: 'Ownerless Book On A Judge Team', teams: [ shared_team ])

      assert_not available_ai_judges_for_book?(book)
    end

    it 'returns true when AI judges are available' do
      # empty_book is owned by doug, who shares the "shared" team with judge_judy
      book = books(:empty_book)
      assert available_ai_judges_for_book?(book)
    end

    it 'returns false when all team AI judges are already assigned' do
      # james_bond_movies already has judge_judy assigned
      book = books(:james_bond_movies)
      assert_not available_ai_judges_for_book?(book)
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
