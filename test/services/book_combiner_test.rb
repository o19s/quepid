# frozen_string_literal: true

require 'test_helper'

class BookCombinerTest < ActiveSupport::TestCase
  setup do
    @user = users(:random)
    @target = Book.create!(name: 'Target', scale: [ 0, 1 ], support_implicit_judgements: true)
    @source = Book.create!(name: 'Source', scale: [ 0, 1 ])
  end

  test 'copies fields, fills missing positions and averages ratings for the same judge' do
    target_pair = pair(@target, position: 4, document_fields: { title: 'Old' })
    target_pair.judgements.create!(user: @user, rating: 0)
    source_pair = pair(@source, position: 2, document_fields: { title: 'New' })
    source_pair.judgements.create!(user: @user, rating: 1)
    source_pair.judgements.create!(user: users(:doug), rating: 1)
    source_pair.judgements.create!(user: nil, rating: 1)
    source_pair.judgements.create!(user: users(:case_finder_user), judge_later: true)
    source_pair.judgements.create!(user: users(:matt), unrateable: true)

    assert_equal 1, BookCombiner.new(@target, [ @source ]).combine
    assert_equal({ 'title' => 'New' }, target_pair.reload.document_fields)
    assert_equal 4, target_pair.position
    assert_in_delta 0.5, target_pair.judgements.find_by!(user: @user).rating
    assert_equal 3, target_pair.judgements.count
    assert_equal 1, target_pair.judgements.find_by!(user: nil).rating
  end

  test 'fills a missing position and rounds explicit ratings' do
    @target.update!(support_implicit_judgements: false)
    target_pair = pair(@target)
    target_pair.judgements.create!(user: @user, rating: 0)
    pair(@source, position: 2).judgements.create!(user: @user, rating: 1)

    BookCombiner.new(@target, [ @source ]).combine

    assert_equal 2, target_pair.reload.position
    assert_equal 1, target_pair.judgements.find_by!(user: @user).rating
  end

  test 'averages multiple sources sequentially and permits merging a book into itself' do
    pair(@target).judgements.create!(user: @user, rating: 0)
    pair(@source).judgements.create!(user: @user, rating: 1)
    second = Book.create!(name: 'Second', scale: [ 0, 1 ])
    pair(second).judgements.create!(user: @user, rating: 0)

    assert_equal 2, BookCombiner.new(@target, [ @source, second ]).combine
    assert_in_delta 0.25, @target.judgements.find_by!(user: @user).rating
    assert_equal 1, BookCombiner.new(@target, [ @target ]).combine
    assert_in_delta 0.25, @target.judgements.find_by!(user: @user).rating
  end

  test 'rejects any scale mismatch before writing pairs' do
    pair(@source)
    second = Book.create!(name: 'Different scale', scale: [ 0, 1, 2 ])

    assert_raises(BookCombiner::ScaleMismatch) { BookCombiner.new(@target, [ @source, second ]).combine }
    assert_empty @target.query_doc_pairs.reload
  end

  test 'rolls back earlier pairs and ratings when a later pair fails validation' do
    existing = pair(@target, document_fields: { title: 'Original' })
    existing.judgements.create!(user: @user, rating: 0)
    pair(@source, document_fields: { title: 'Replacement' }).judgements.create!(user: @user, rating: 1)
    invalid = @source.query_doc_pairs.create!(query_text: 'Later', doc_id: 'later')
    invalid.update_columns(query_text: '')

    assert_raises(ActiveRecord::RecordInvalid) { BookCombiner.new(@target, [ @source ]).combine }

    assert_equal 1, @target.query_doc_pairs.count
    assert_equal({ 'title' => 'Original' }, existing.reload.document_fields)
    assert_equal 0, existing.judgements.find_by!(user: @user).rating
  end

  test 'rolls back new pairs when a judgement fails validation' do
    pair(@source).judgements.create!(user: @user, rating: 1)
    invalid = @source.query_doc_pairs.create!(query_text: 'Later', doc_id: 'later')
    invalid.judgements.create!(user: @user, rating: 1).update_columns(rating: nil)

    assert_no_enqueued_jobs only: UpdateCaseRatingsJob do
      assert_raises(ActiveRecord::RecordInvalid) { BookCombiner.new(@target, [ @source ]).combine }
    end
    assert_empty @target.query_doc_pairs.reload
  end

  test 'rolls back pairs if the final book save fails' do
    pair(@source).judgements.create!(user: @user, rating: 1)
    @target.name = ''

    assert_no_enqueued_jobs only: UpdateCaseRatingsJob do
      assert_raises(ActiveRecord::RecordInvalid) { BookCombiner.new(@target, [ @source ]).combine }
    end
    assert_empty @target.query_doc_pairs.reload
  end

  private

  def pair book, **attributes
    book.query_doc_pairs.create!({ query_text: 'Query', doc_id: 'doc' }.merge(attributes))
  end
end
