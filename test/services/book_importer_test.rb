# frozen_string_literal: true

require 'test_helper'

class BookImporterTest < ActiveSupport::TestCase
  let(:user)  { users(:random) }
  let(:doug)  { users(:doug) }
  let(:book)  { Book.new }

  let(:data) do
    {
      name:              'test book',
      scale:             [ 0, 1 ],
      scale_with_labels: { '0' => 'Not Relevant', '1' => 'Relevant' },
      query_doc_pairs:   [
        {
          query_text: 'dog', doc_id: '123',
          judgements: [
            { rating: 1.0, unrateable: false, user_email: user.email },
            { rating: 2.0, unrateable: false, user_email: doug.email }
          ]
        },
        { query_text: 'dog', doc_id: '234' }
      ],
    }
  end

  describe '#validate' do
    test 'does not add errors when all judgement users already exist' do
      importer = BookImporter.new book, user, data

      importer.validate

      assert_empty book.errors
    end

    test 'adds an error when a judgement user email does not exist and force_create_users is false' do
      data[:query_doc_pairs].first[:judgements] << { rating: 3.0, user_email: 'fakeuser@fake.com' }

      importer = BookImporter.new book, user, data

      importer.validate

      assert_includes book.errors[:base], "User with email 'fakeuser@fake.com' needs to be migrated over first."
    end

    test 'creates a missing user instead of erroring when force_create_users is true' do
      data[:query_doc_pairs].first[:judgements] << { rating: 3.0, user_email: 'newuser@fake.com' }

      importer = BookImporter.new book, user, data, force_create_users: true

      assert_difference 'User.count', 1 do
        importer.validate
      end

      assert_empty book.errors
      assert User.exists?(email: 'newuser@fake.com')
    end

    test 'sets scale and scale_with_labels on the book' do
      importer = BookImporter.new book, user, data

      importer.validate

      assert_equal [ 0, 1 ], book.scale
      assert_equal({ '0' => 'Not Relevant', '1' => 'Relevant' }, book.scale_with_labels)
    end
  end

  describe '#import' do
    test 'creates the book with the current user as owner' do
      importer = BookImporter.new book, user, data
      importer.import

      assert_predicate book, :persisted?
      assert_equal 'test book', book.name
      assert_equal user, book.owner
    end

    test 'creates query_doc_pairs and judgements for each entry' do
      importer = BookImporter.new book, user, data
      importer.import

      assert_equal 2, book.query_doc_pairs.count
      assert_equal 2, book.judgements.count

      qdp = book.query_doc_pairs.find_by(doc_id: '123')
      assert_equal 2, qdp.judgements.count
      assert_equal [ user, doug ].sort_by(&:id), qdp.judgements.map(&:user).sort_by(&:id)
    end

    test 'creates a query_doc_pair with no judgements when none are given' do
      importer = BookImporter.new book, user, data
      importer.import

      qdp = book.query_doc_pairs.find_by(doc_id: '234')
      assert_empty qdp.judgements
    end

    test 'prefers scorer scale information over top level scale when both are given' do
      data[:scorer] = { scale: [ 0, 1, 2 ], scale_with_labels: { '0' => 'Bad', '1' => 'OK', '2' => 'Great' } }

      importer = BookImporter.new book, user, data
      importer.import

      assert_equal [ 0, 1, 2 ], book.scale
      assert_equal({ '0' => 'Bad', '1' => 'OK', '2' => 'Great' }, book.scale_with_labels)
    end
  end
end
