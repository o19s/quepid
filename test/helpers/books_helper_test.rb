# frozen_string_literal: true

require 'test_helper'

class BooksHelperTest < ActionView::TestCase
  let(:team) { teams(:shared) }
  
  setup do
    @book = Book.create!(
      name: 'Test Book for AI Judges',
      scorer: scorers(:valid)
    )
    @book.teams << team
    
    @ai_judge = User.create!(
      name: 'Test AI Judge',
      email: 'test_ai@example.com',
      password: 'password',
      llm_key: 'sk-test-key',
      system_prompt: 'You are a test AI judge'
    )
    
    @regular_user = User.create!(
      name: 'Test Regular User', 
      email: 'test_regular@example.com',
      password: 'password'
    )
  end

  describe '#available_ai_judges_for_book' do
    it 'returns empty when book has no teams' do
      teamless_book = Book.create!(name: 'Teamless Book', scorer: scorers(:valid))
      result = available_ai_judges_for_book(teamless_book)
      assert_empty result
    end

    it 'returns AI judges from book teams that are not already assigned' do
      team.members << @ai_judge
      
      available_judges = available_ai_judges_for_book(@book)
      assert_includes available_judges, @ai_judge
    end

    it 'excludes AI judges already assigned to the book' do
      team.members << @ai_judge
      @book.ai_judges << @ai_judge
      
      available_judges = available_ai_judges_for_book(@book)
      assert_not_includes available_judges, @ai_judge
    end

    it 'only returns actual AI judges (users with llm_key)' do
      team.members << @regular_user
      team.members << @ai_judge
      
      available_judges = available_ai_judges_for_book(@book)
      assert_includes available_judges, @ai_judge
      assert_not_includes available_judges, @regular_user
    end
  end

  describe '#has_available_ai_judges_for_book?' do
    it 'returns false when no AI judges are available' do
      assert_not has_available_ai_judges_for_book?(@book)
    end

    it 'returns false when book has no teams' do
      teamless_book = Book.create!(name: 'Teamless Book', scorer: scorers(:valid))
      assert_not has_available_ai_judges_for_book?(teamless_book)
    end

    it 'returns true when AI judges are available' do
      team.members << @ai_judge
      assert has_available_ai_judges_for_book?(@book)
    end

    it 'returns false when all AI judges are already assigned' do
      team.members << @ai_judge
      @book.ai_judges << @ai_judge
      assert_not has_available_ai_judges_for_book?(@book)
    end
  end
end