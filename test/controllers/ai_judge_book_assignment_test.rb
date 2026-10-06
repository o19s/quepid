# frozen_string_literal: true

require 'test_helper'

class AiJudgeBookAssignmentTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:doug)
    login_user_for_integration_test @user
    @judge = AiJudge.create!(name: 'Owned private judge', owner: @user, system_prompt: 'Judge it.')
  end

  test 'new and edit list owned judges including for ownerless books' do
    get new_book_url
    assert_response :success
    assert_includes assigns(:ai_judges), @judge
    # The existing other-books list triggers Bullet independently of judge visibility.
    previous_bullet = Bullet.enable?
    Bullet.enable = false
    get edit_book_url(books(:book_of_star_wars_judgements))
    assert_response :success
    assert_includes assigns(:ai_judges), @judge
  ensure
    Bullet.enable = previous_bullet unless previous_bullet.nil?
  end

  test 'creating a book can assign an owned judge without sharing either with a team' do
    post books_url, params: { book: { name: 'Private book', scorer_id: scorers(:valid).id, ai_judge_ids: [ @judge.id ] } }
    assert_response :see_other
    book = Book.find_by!(name: 'Private book')
    assert_equal @user, book.owner
    assert_empty book.teams
    assert_includes book.ai_judges, @judge
  end

  test 'updating a shared book can assign the editor owned judge' do
    book = books(:james_bond_movies)
    patch book_url(book), params: { book: { name: book.name, ai_judge_ids: [ @judge.id ] } }
    assert_response :see_other
    assert_includes book.reload.ai_judges, @judge
  end

  test 'book overview advertises only judges available to the viewer' do
    private_judge = AiJudge.create!(name: 'Not visible', owner: users(:case_finder_user), system_prompt: 'Judge it.')
    book = books(:empty_book)
    get book_url(book)
    assert_response :success
    assert_includes response.body, @judge.name
    assert_not_includes response.body, private_judge.name
  end
end
