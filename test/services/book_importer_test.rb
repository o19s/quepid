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

    # An uploaded file's casing is outside our control (see User#by_email); a byte-exact lookup
    # here would flag an existing user as missing on any adapter that isn't MySQL.
    test 'does not add an error when a judgement user email differs only in case' do
      data[:query_doc_pairs].first[:judgements] << { rating: 3.0, user_email: user.email.upcase }

      importer = BookImporter.new book, user, data

      importer.validate

      assert_empty book.errors
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

    test 'sets the owner on a persisted book that does not have one yet' do
      saved_book = Book.create!(name: 'Queued Book')

      importer = BookImporter.new saved_book, user, data
      importer.import

      # reload, not the in-memory attribute: #import discards @book.save's return value, so
      # asserting the attribute passes even when the claim never reaches the database.
      assert_equal user, saved_book.reload.owner
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

    # A byte-exact lookup here would leave the judgement orphaned (nil user) instead of
    # attributed to the existing user - silent data corruption, not an error. See User#by_email.
    test 'attributes a judgement to the existing user even when the email case differs' do
      data[:query_doc_pairs].first[:judgements] = [
        { rating: 1.0, unrateable: false, user_email: user.email.upcase }
      ]

      importer = BookImporter.new book, user, data
      importer.import

      qdp = book.query_doc_pairs.find_by(doc_id: '123')
      assert_equal user, qdp.judgements.first.user
    end

    # The exporter omits user_email for a nil-user judgement, and Judgement's uniqueness
    # validation exempts nil user_id, so anonymous judgements must not be collapsed into one row.
    test 'keeps every anonymous judgement on a pair instead of collapsing them into one' do
      data[:query_doc_pairs] = [
        {
          query_text: 'dog', doc_id: '123',
          judgements: [
            { rating: 1.0, unrateable: false },
            { rating: 3.0, unrateable: false }
          ]
        }
      ]

      # Precondition for the misattribution half of this test: an email-less user has to exist
      # for an unguarded find_by(email: nil) to have something to wrongly match.
      assert_predicate User.where(email: nil), :exists?

      importer = BookImporter.new book, user, data
      importer.import

      qdp = book.query_doc_pairs.find_by(doc_id: '123')
      assert_equal 2, qdp.judgements.count
      assert_empty qdp.judgements.map(&:user).compact
      assert_equal [ 1.0, 3.0 ], qdp.judgements.map(&:rating).sort
    end

    # The duplication here is the accepted tradeoff of not collapsing anonymous judgements, but
    # it is not confined to row counts: RatingsManager averages 1-2 judgements and switches to
    # "min of the top 3" at 3+, so a re-import can move a computed case rating. Pinned so the
    # cost stays visible if anyone revisits the tradeoff.
    test 're-importing anonymous judgements duplicates them and moves the computed case rating' do
      data[:query_doc_pairs] = [
        {
          query_text: 'dog', doc_id: '123',
          judgements: [
            { rating: 3.0, unrateable: false },
            { rating: 0.0, unrateable: false, user_email: user.email }
          ]
        }
      ]

      BookImporter.new(book, user, data.deep_dup).import
      kase = Case.create!(case_name: 'Ratings Case', owner: user, book: book)
      RatingsManager.new(book, create_missing_queries: true).sync_ratings_for_case(kase)

      rating = Rating.joins(:query).find_by(queries: { case_id: kase.id }, doc_id: '123')
      assert_in_delta(2.0, rating.rating) # [3.0, 0.0] -> mean 1.5 -> rounded

      BookImporter.new(book, user, data.deep_dup).import

      qdp = book.query_doc_pairs.find_by(doc_id: '123')
      assert_equal 3, qdp.judgements.count # the anonymous 3.0 doubled, the user's 0.0 upserted

      RatingsManager.new(book, create_missing_queries: true).sync_ratings_for_case(kase)

      assert_in_delta(0.0, rating.reload.rating) # [3.0, 3.0, 0.0] -> min of the top 3
    end

    test 'still upserts, rather than duplicating, a judgement belonging to a known user' do
      importer = BookImporter.new book, user, data
      importer.import

      data[:query_doc_pairs].first[:judgements] = [ { rating: 0.0, unrateable: false, user_email: user.email } ]
      BookImporter.new(book, user, data).import

      qdp = book.query_doc_pairs.find_by(doc_id: '123')
      assert_equal 2, qdp.judgements.count
      assert_in_delta(0.0, qdp.judgements.find_by(user: user).rating)
    end

    # A nested judgement's parentage is decided by the pair it sits inside - a crafted file must
    # not be able to reparent it, or claim an existing row's id, via the judgement's own keys.
    test 'ignores query_doc_pair_id and id on a nested judgement instead of reparenting it' do
      other_book = Book.create!(name: 'Other Book', owner: doug)
      foreign_qdp = other_book.query_doc_pairs.create!(query_text: 'other', doc_id: 'other-1')

      data[:query_doc_pairs] = [
        {
          query_text: 'dog', doc_id: '123',
          judgements: [
            {
              rating:            1.0,
              unrateable:        false,
              user_email:        user.email,
              query_doc_pair_id: foreign_qdp.id,
              id:                987_654,
            }
          ]
        }
      ]

      importer = BookImporter.new book, user, data
      importer.import

      qdp = book.query_doc_pairs.find_by(doc_id: '123')
      assert_equal 1, qdp.judgements.count
      assert_empty foreign_qdp.judgements
      assert_not_equal 987_654, qdp.judgements.first.id
    end

    # assign_attributes happily overwrites created_at/updated_at, and Rails only backfills them
    # when blank - without the denylist entry, a crafted file could forge a row's history.
    test 'ignores created_at and updated_at on a nested judgement and query_doc_pair' do
      forged = 3.years.ago

      data[:query_doc_pairs] = [
        {
          query_text: 'dog', doc_id: '123', created_at: forged, updated_at: forged,
          judgements: [
            { rating: 1.0, unrateable: false, user_email: user.email, created_at: forged, updated_at: forged }
          ]
        }
      ]

      importer = BookImporter.new book, user, data
      importer.import

      qdp = book.query_doc_pairs.find_by(doc_id: '123')
      assert_operator qdp.created_at, :>, 1.minute.ago
      assert_operator qdp.judgements.first.created_at, :>, 1.minute.ago
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

      test 'claims an existing book that has no owner for the importing user' do
        unowned_book = Book.create!(name: 'Unowned Book')

        importer = BookImporter.new unowned_book, user, partial_data
        importer.import

        assert_equal user, unowned_book.reload.owner
      end

      # A pair's book is decided by which book you're importing into - a crafted book_id or id
      # must not be able to move it, or an existing row from another book, into this one.
      test 'ignores book_id and id on a new query_doc_pair instead of moving it into this book' do
        other_book = Book.create!(name: 'Other Book', owner: doug)
        foreign_qdp = other_book.query_doc_pairs.create!(query_text: 'foreign', doc_id: 'f-1')

        data_with_crafted_keys = {
          query_doc_pairs: [
            { query_text: 'new', doc_id: 'new-1', book_id: other_book.id, id: foreign_qdp.id }
          ],
        }

        importer = BookImporter.new existing_book, user, data_with_crafted_keys
        importer.import

        added = existing_book.query_doc_pairs.find_by(doc_id: 'new-1')
        assert_not_nil added
        assert_not_equal foreign_qdp.id, added.id
        assert_equal 1, other_book.reload.query_doc_pairs.count
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

      # The all_judgements path resolves its judge through the same find_judgement_user as the
      # nested path, so it has to leave a user-less entry unattributed rather than matching an
      # email-less AI judge.
      test 'keeps an anonymous all_judgements entry unattributed on the upserted pair' do
        assert_predicate User.where(email: nil), :exists?

        data_with_judgements = {
          all_judgements: [
            { rating: 1.0, query_doc_pair: { query_text: 'anon query', doc_id: '77' } }
          ],
        }

        importer = BookImporter.new existing_book, user, data_with_judgements
        importer.import

        qdp = existing_book.query_doc_pairs.find_by(doc_id: '77')
        assert_not_nil qdp
        assert_equal 1, qdp.judgements.count
        assert_nil qdp.judgements.first.user
        assert_in_delta(1.0, qdp.judgements.first.rating)
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
