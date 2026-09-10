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

    describe 'importing additional data into an existing book' do
      let(:existing_book) { Book.create!(name: 'Existing Book', owner: doug, show_rank: true) }
      let(:partial_data) { { query_doc_pairs: [ { query_text: 'cat', doc_id: '999' } ] } }

      test 'does not null out the name, owner, or other settings when they are absent from the payload' do
        importer = BookImporter.new existing_book, user, partial_data
        importer.import

        assert_equal 'Existing Book', existing_book.name
        assert_equal doug, existing_book.owner
        assert_predicate existing_book, :show_rank?
      end

      test 'upserts a query_doc_pair by query_doc_pair_id instead of creating a duplicate' do
        qdp = existing_book.query_doc_pairs.create!(query_text: 'old', doc_id: '1')
        data_with_id = { query_doc_pairs: [ { query_doc_pair_id: qdp.id, query_text: 'new', doc_id: '1' } ] }

        importer = BookImporter.new existing_book, user, data_with_id
        importer.import

        assert_equal 1, existing_book.query_doc_pairs.count
        assert_equal 'new', qdp.reload.query_text
      end

      test 'upserts a query_doc_pair by query_text/doc_id when re-imported without an id' do
        existing_book.query_doc_pairs.create!(query_text: 'cat', doc_id: '999', document_fields: { 'a' => 1 })

        importer = BookImporter.new existing_book, user, partial_data
        importer.import

        assert_equal 1, existing_book.query_doc_pairs.count
      end

      test 'falls back to query_text/doc_id, instead of forcing a foreign id onto a new record, when query_doc_pair_id does not belong to this book' do
        other_book = Book.create!(name: 'Other Book', owner: doug)
        foreign_qdp = other_book.query_doc_pairs.create!(query_text: 'other', doc_id: 'other-1')
        data_with_foreign_id = {
          query_doc_pairs: [ { query_doc_pair_id: foreign_qdp.id, query_text: 'cat', doc_id: '999' } ],
        }

        importer = BookImporter.new existing_book, user, data_with_foreign_id

        assert_nothing_raised do
          importer.import
        end

        added = existing_book.query_doc_pairs.find_by(doc_id: '999')
        assert_not_nil added
        assert_not_equal foreign_qdp.id, added.id
      end
    end

    describe 'importing all_judgements' do
      let(:existing_book) { Book.create!(name: 'Existing Book', owner: doug) }

      test 'resolves the query_doc_pair by query_doc_pair_id and the user by user_id' do
        qdp = existing_book.query_doc_pairs.create!(query_text: 'cat', doc_id: '1')
        data_with_judgements = {
          all_judgements: [
            { rating: 2.0, query_doc_pair_id: qdp.id, user_id: user.id }
          ],
        }

        importer = BookImporter.new existing_book, user, data_with_judgements
        importer.import

        judgement = qdp.judgements.find_by(user: user)
        assert_in_delta(2.0, judgement.rating)
      end

      test 'resolves the user by email and upserts the nested query_doc_pair by query_text/doc_id' do
        data_with_judgements = {
          all_judgements: [
            {
              rating:         3.0,
              email:          user.email,
              query_doc_pair: { query_text: 'new query', doc_id: '42' },
            }
          ],
        }

        importer = BookImporter.new existing_book, user, data_with_judgements
        importer.import

        qdp = existing_book.query_doc_pairs.find_by(doc_id: '42')
        assert_not_nil qdp
        judgement = qdp.judgements.find_by(user: user)
        assert_in_delta(3.0, judgement.rating)
      end

      test 'skips a judgement whose query_doc_pair_id cannot be resolved' do
        data_with_judgements = { all_judgements: [ { rating: 1.0, query_doc_pair_id: 999_999, user_id: user.id } ] }

        importer = BookImporter.new existing_book, user, data_with_judgements

        assert_nothing_raised do
          importer.import
        end
        assert_empty existing_book.judgements
      end

      test 'adds emails from all_judgements to the list validated for existence' do
        data_with_judgements = { all_judgements: [ { rating: 1.0, email: 'fakeuser@fake.com' } ] }

        importer = BookImporter.new existing_book, user, data_with_judgements
        importer.validate

        assert_includes existing_book.errors[:base], "User with email 'fakeuser@fake.com' needs to be migrated over first."
      end
    end
  end
end
