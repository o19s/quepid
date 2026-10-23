# frozen_string_literal: true

require 'test_helper'

class BookImporterTest < ActiveSupport::TestCase
  cover 'BookImporter*'
  cover 'RatingsManager*'

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
    test 'does not attach validation candidates to a new books autosave collection' do
      book.name = 'Detached validation'
      payload = {
        judgements: [
          { query_doc_pair: { query_text: 'invalid' }, rating: 1 },
          { query_text: 'cat', doc_id: '42', rating: 3, user_id: user.id }
        ],
      }
      importer = BookImporter.new(book, user, payload)

      importer.validate

      assert_empty book.errors
      assert_empty book.query_doc_pairs.target
      assert book.save
      assert_empty book.query_doc_pairs
      assert importer.import
      assert_equal 1, book.judgements.count
    end

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
    test 'validates and imports flat judgements into a new book without a name' do
      payload = { judgements: [ { query_text: 'cat', doc_id: '42', rating: 1, email: user.email } ] }
      importer = BookImporter.new(book, user, payload)
      importer.validate
      assert_empty book.errors
      assert importer.import
      assert_equal BookImporter::DEFAULT_BOOK_NAME, book.reload.name
      assert_equal user, book.judgements.first!.user
    end

    test 'upserts flat judgements using the legacy envelope' do
      payload = { all_judgements: [ { query_text: 'cat', doc_id: '42', rating: 1, user_id: user.id } ] }
      assert BookImporter.new(book, user, payload).import
      payload[:all_judgements].first[:rating] = 2
      assert BookImporter.new(book, user, payload).import
      assert_equal 1, book.query_doc_pairs.count
      assert_equal 1, book.judgements.count
      assert_in_delta 2, book.judgements.first!.rating
    end

    test 'creates the book with the current user as owner' do
      importer = BookImporter.new book, user, data
      importer.import

      assert_predicate book, :persisted?
      assert_equal 'test book', book.name
      assert_equal user, book.owner
    end

    test 'falls back to a default name when the file does not provide one' do
      data.delete(:name)

      BookImporter.new(book, user, data).import

      assert_predicate book, :persisted?
      assert_equal BookImporter::DEFAULT_BOOK_NAME, book.name
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
    # when blank - if they were assignable, a crafted file could forge a row's history.
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

    # The judgements export emits `judgement_id`, and other producers may add keys; anything that
    # isn't an importable attribute is dropped instead of raising UnknownAttributeError.
    test 'ignores keys that are not importable attributes' do
      data[:query_doc_pairs] = [
        {
          query_text: 'dog', doc_id: '123', not_a_column: 'x',
          judgements: [
            { rating: 2.0, user_email: user.email, judgement_id: 42, not_a_column: 'x' }
          ]
        }
      ]

      importer = BookImporter.new book, user, data
      importer.import

      qdp = book.query_doc_pairs.find_by(doc_id: '123')
      assert_not_nil qdp
      assert_in_delta 2.0, qdp.judgements.first.rating
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

        assert_not importer.import
        assert_includes existing_book.errors[:base].join, 'No judgements could be imported'
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

  describe 'construction' do
    test 'defaults the logger, progress and user creation options' do
      importer = BookImporter.new(book, user, {})

      assert_same Rails.logger, importer.logger
      assert_equal({ logger: Rails.logger, show_progress: false, force_create_users: false }, importer.options)
    end

    test 'merges string-keyed overrides over the defaults' do
      custom = Logger.new(nil)
      importer = BookImporter.new(book, user, {}, 'logger' => custom, 'force_create_users' => true)

      assert_same custom, importer.logger
      assert importer.options[:force_create_users]
      assert_not importer.options[:show_progress]
    end
  end

  describe 'top level attributes' do
    test 'applies name, show_rank and support_implicit_judgements and persists them' do
      new_book = Book.new
      BookImporter.new(new_book, user, { name: 'Named', show_rank: true, support_implicit_judgements: true }).import

      new_book.reload
      assert_equal 'Named', new_book.name
      assert new_book.show_rank
      assert new_book.support_implicit_judgements
    end

    test 'explicit false values override what the book already has' do
      existing = Book.create!(name: 'Keep', owner: doug, show_rank: true, support_implicit_judgements: true)
      BookImporter.new(existing, user, { show_rank: false, support_implicit_judgements: false }).import

      existing.reload
      assert_not existing.show_rank
      assert_not existing.support_implicit_judgements
    end

    test 'absent keys leave the existing values alone' do
      existing = Book.create!(name: 'Keep', owner: doug, show_rank: true, support_implicit_judgements: true)
      BookImporter.new(existing, user, { query_doc_pairs: [] }).import

      existing.reload
      assert_equal 'Keep', existing.name
      assert existing.show_rank
      assert existing.support_implicit_judgements
    end

    test 'a blank name falls back to the default' do
      new_book = Book.new
      BookImporter.new(new_book, user, { name: '' }).import

      assert_equal 'Imported Book', new_book.reload.name
    end
  end

  describe 'scale handling on import' do
    let(:labels) { { '0' => 'No', '1' => 'Yes' } }

    test 'a top level scale and labels are persisted without a prior validate' do
      new_book = Book.new
      BookImporter.new(new_book, user, { name: 'S', scale: [ 0, 1 ], scale_with_labels: labels }).import

      new_book.reload
      assert_equal [ 0, 1 ], new_book.scale
      assert_equal labels, new_book.scale_with_labels
    end

    test 'a top level scale without labels leaves the labels alone' do
      existing = Book.create!(name: 'S', owner: doug, scale: [ 0, 1, 2 ], scale_with_labels: { '0' => 'Old' })
      BookImporter.new(existing, user, { scale: [ 0, 1 ] }).import

      existing.reload
      assert_equal [ 0, 1 ], existing.scale
      assert_equal({ '0' => 'Old' }, existing.scale_with_labels)
    end

    test 'top level labels without a scale are not applied' do
      existing = Book.create!(name: 'S', owner: doug, scale: [ 0, 1 ], scale_with_labels: { '0' => 'Old' })
      BookImporter.new(existing, user, { scale_with_labels: labels }).import

      assert_equal({ '0' => 'Old' }, existing.reload.scale_with_labels)
    end

    test 'a scorer block wins and keeps the top level scale from being used' do
      existing = Book.create!(name: 'S', owner: doug, scale: [ 0, 1, 2 ], scale_with_labels: { '0' => 'Old' })
      BookImporter.new(existing, user, { scale: [ 0, 1 ], scale_with_labels: labels, scorer: {} }).import

      existing.reload
      assert_equal [ 0, 1, 2 ], existing.scale
      assert_equal({ '0' => 'Old' }, existing.scale_with_labels)
    end

    test 'scorer scale and labels are applied independently when present' do
      existing = Book.create!(name: 'S', owner: doug, scale: [ 0, 1, 2 ], scale_with_labels: { '0' => 'Old' })
      BookImporter.new(existing, user, { scorer: { scale: [ 0, 1 ] } }).import
      existing.reload
      assert_equal [ 0, 1 ], existing.scale
      assert_equal({ '0' => 'Old' }, existing.scale_with_labels)

      BookImporter.new(existing, user, { scorer: { scale: [], scale_with_labels: labels } }).import
      existing.reload
      assert_equal [ 0, 1 ], existing.scale
      assert_equal labels, existing.scale_with_labels
    end

    test 'validate only touches scale and labels that are present in the payload' do
      existing = Book.create!(name: 'S', owner: doug, scale: [ 0, 1, 2 ], scale_with_labels: { '0' => 'Old' })
      BookImporter.new(existing, user, {}).validate
      assert_equal [ 0, 1, 2 ], existing.scale
      assert_equal({ '0' => 'Old' }, existing.scale_with_labels)

      BookImporter.new(existing, user, { scale: [ 0, 1 ], scale_with_labels: {} }).validate
      assert_equal [ 0, 1 ], existing.scale
      assert_equal({ '0' => 'Old' }, existing.scale_with_labels)
    end
  end

  describe 'user creation on validate' do
    let(:payload) { { query_doc_pairs: [ { query_text: 'q', doc_id: '1', judgements: [ { rating: 1, user_email: 'newjudge@example.com' } ] } ] } }

    test 'force_create_users invites a user without sending an invitation, on behalf of the importer' do
      BookImporter.new(book, user, payload, force_create_users: true).validate

      invited = User.by_email('newjudge@example.com').first
      assert_not_nil invited
      assert_equal user, invited.invited_by
      assert_nil invited.invitation_sent_at
      assert_empty book.errors[:base]
    end

    test 'only a literal true forces user creation' do
      BookImporter.new(book, user, payload, force_create_users: 'yes').validate

      assert_not User.by_email('newjudge@example.com').exists?
      assert_includes book.errors[:base], "User with email 'newjudge@example.com' needs to be migrated over first."
    end

    test 'each missing email is reported once and blank emails are ignored' do
      payload = {
        query_doc_pairs: [ { query_text: 'q', doc_id: '1', judgements: [
          { rating: 1, user_email: 'ghost@example.com' }, { rating: 2, user_email: 'ghost@example.com' },
          { rating: 3, user_email: '' }, { rating: 4 }
        ] } ],
        all_judgements:  [ { email: 'other@example.com', query_text: 'q', doc_id: '1', rating: 1 },
                           { user_email: 'ghost@example.com', email: 'ignored@example.com', rating: 1 },
                           { email: '' }, {} ],
      }
      BookImporter.new(book, user, payload).validate

      assert_equal [ "User with email 'ghost@example.com' needs to be migrated over first.",
                     "User with email 'other@example.com' needs to be migrated over first." ],
                   book.errors[:base]
    end
  end

  describe 'standalone judgement validation' do
    let(:existing_book) { Book.create!(name: 'Existing Book', owner: doug) }
    let(:no_judgements_message) { 'No judgements could be imported. Provide a query_doc_pair_id belonging to this book, or both query_text and doc_id, and a valid judgement.' }

    test 'a payload with neither pairs nor judgements adds no error' do
      BookImporter.new(existing_book, user, {}).validate

      assert_empty existing_book.errors[:base]
    end

    test 'unusable judgements are not an error when query_doc_pairs are also supplied' do
      payload = { query_doc_pairs: [ { query_text: 'q', doc_id: '1' } ], all_judgements: [ { rating: 1 } ] }
      BookImporter.new(existing_book, user, payload).validate

      assert_empty existing_book.errors[:base]
    end

    test 'judgements that cannot be resolved to a valid pair are an error' do
      BookImporter.new(existing_book, user, { all_judgements: [ { rating: 1 }, { query_text: 'only text', rating: 1 } ] }).validate

      assert_equal [ no_judgements_message ], existing_book.errors[:base]
    end

    test 'one usable judgement among unusable ones is enough' do
      payload = { all_judgements: [ { rating: 1 }, { query_text: 'q', doc_id: '1', rating: 2, user_id: user.id } ] }
      BookImporter.new(existing_book, user, payload).validate

      assert_empty existing_book.errors[:base]
    end

    test 'a valid pair with an invalid judgement is an error' do
      pair = existing_book.query_doc_pairs.create!(query_text: 'q', doc_id: '1')
      payload = { all_judgements: [ { query_doc_pair_id: pair.id, user_id: user.id, rating: nil } ] }
      BookImporter.new(existing_book, user, payload).validate

      assert_equal [ no_judgements_message ], existing_book.errors[:base]
    end

    test 'an unrateable judgement without a rating is valid' do
      pair = existing_book.query_doc_pairs.create!(query_text: 'q', doc_id: '1')
      payload = { all_judgements: [ { query_doc_pair_id: pair.id, user_id: user.id, unrateable: true } ] }
      BookImporter.new(existing_book, user, payload).validate

      assert_empty existing_book.errors[:base]
    end

    test 'an existing judgement by the same user is updated, not treated as a duplicate' do
      pair = existing_book.query_doc_pairs.create!(query_text: 'q', doc_id: '1')
      pair.judgements.create!(user: user, rating: 1)
      payload = { all_judgements: [ { query_doc_pair_id: pair.id, user_id: user.id, rating: 3 } ] }
      BookImporter.new(existing_book, user, payload).validate

      assert_empty existing_book.errors[:base]
    end
  end

  describe 'resolving the pair for standalone judgements' do
    let(:existing_book) { Book.create!(name: 'Existing Book', owner: doug) }
    let(:other_book) { Book.create!(name: 'Other Book', owner: doug) }

    test 'a pair id from another book is not resolved' do
      foreign = other_book.query_doc_pairs.create!(query_text: 'q', doc_id: '1')

      assert_no_difference 'Judgement.count' do
        BookImporter.new(existing_book, user, { all_judgements: [ { query_doc_pair_id: foreign.id, user_id: user.id, rating: 1 } ] }).import
      end
    end

    test 'a nested pair with the same text as another books pair creates its own pair' do
      foreign = other_book.query_doc_pairs.create!(query_text: 'q', doc_id: '1')
      BookImporter.new(existing_book, user,
                       { all_judgements: [ { query_doc_pair: { query_text: 'q', doc_id: '1' }, user_id: user.id, rating: 1 } ] }).import

      assert_equal 1, existing_book.query_doc_pairs.where(query_text: 'q', doc_id: '1').count
      assert_empty foreign.judgements
    end

    test 'a nested pair applies assignable attributes and ignores the rest' do
      BookImporter.new(existing_book, user, { all_judgements: [ {
        query_doc_pair: { query_text: 'q', doc_id: '1', position: 4, notes: 'n', information_need: 'need', book_id: other_book.id },
        user_id:        user.id, rating: 1
      } ] }).import

      pair = existing_book.query_doc_pairs.find_by!(query_text: 'q', doc_id: '1')
      assert_equal 4, pair.position
      assert_equal 'n', pair.notes
      assert_equal 'need', pair.information_need
      assert_equal existing_book, pair.book
    end

    test 'an empty nested pair falls back to the pair id' do
      pair = existing_book.query_doc_pairs.create!(query_text: 'q', doc_id: '1')
      BookImporter.new(existing_book, user, { all_judgements: [ { query_doc_pair: {}, query_doc_pair_id: pair.id, user_id: user.id, rating: 2 } ] }).import

      assert_equal 2, pair.judgements.find_by!(user: user).rating
    end

    test 'a blank pair id falls back to query text and doc id' do
      BookImporter.new(existing_book, user, { all_judgements: [ { query_doc_pair_id: '', query_text: 'q', doc_id: '1', user_id: user.id, rating: 2 } ] }).import

      assert_equal 2, existing_book.query_doc_pairs.find_by!(query_text: 'q', doc_id: '1').judgements.first.rating
    end

    test 'query text without a doc id or the reverse resolves nothing' do
      assert_no_difference [ 'QueryDocPair.count', 'Judgement.count' ] do
        BookImporter.new(existing_book, user, { all_judgements: [ { query_text: 'q', rating: 1 }, { doc_id: '1', rating: 1 } ] }).import
      end
    end

    test 'an import with only unusable judgements and no pairs fails' do
      importer = BookImporter.new(existing_book, user, { all_judgements: [ { rating: 1 } ] })

      assert_not importer.import
      assert_equal 1, existing_book.errors[:base].size
    end

    test 'judgements alongside pairs that import nothing still succeed' do
      assert BookImporter.new(existing_book, user, { all_judgements: [ { rating: 1 } ], query_doc_pairs: [ { query_text: 'q', doc_id: '1' } ] }).import
    end

    test 'an empty pair list with unusable judgements still fails' do
      assert_not BookImporter.new(existing_book, user, { all_judgements: [ { rating: 1 } ], query_doc_pairs: [] }).import
    end
  end

  describe 'resolving the judge' do
    let(:existing_book) { Book.create!(name: 'Existing Book', owner: doug) }
    let(:pair) { existing_book.query_doc_pairs.create!(query_text: 'q', doc_id: '1') }

    test 'the user id wins over the email' do
      BookImporter.new(existing_book, user, { all_judgements: [ { query_doc_pair_id: pair.id, user_id: user.id, user_email: doug.email, rating: 1 } ] }).import

      assert_equal [ user ], pair.judgements.map(&:user)
    end

    test 'an unknown user id falls back to the email' do
      BookImporter.new(existing_book, user, { all_judgements: [ { query_doc_pair_id: pair.id, user_id: 0, user_email: doug.email, rating: 1 } ] }).import

      assert_equal [ doug ], pair.judgements.map(&:user)
    end

    test 'user_email wins over email, a blank user_email falls through to email' do
      BookImporter.new(existing_book, user, { all_judgements: [
                         { query_doc_pair_id: pair.id, user_email: doug.email, email: user.email, rating: 1 }
                       ] }).import
      assert_equal [ doug ], pair.judgements.reload.map(&:user)

      other = existing_book.query_doc_pairs.create!(query_text: 'q2', doc_id: '2')
      BookImporter.new(existing_book, user, { all_judgements: [
                         { query_doc_pair_id: other.id, user_email: '', email: user.email, rating: 1 }
                       ] }).import
      assert_equal [ user ], other.judgements.map(&:user)
    end

    test 'no user id and no email leaves the judgement anonymous' do
      BookImporter.new(existing_book, user, { all_judgements: [ { query_doc_pair_id: pair.id, rating: 1 } ] }).import

      assert_equal [ nil ], pair.judgements.map(&:user)
    end
  end

  describe 'importing query_doc_pairs' do
    let(:existing_book) { Book.create!(name: 'Existing Book', owner: doug) }

    test 'a pair without judgements does not stop the following pairs from importing theirs' do
      BookImporter.new(existing_book, user, { query_doc_pairs: [
                         { query_text: 'a', doc_id: '1' },
                         { query_text: 'b', doc_id: '2', judgements: [ { rating: 2, user_id: user.id } ] }
                       ] }).import

      assert_equal 2, existing_book.query_doc_pairs.count
      assert_equal [ 2 ], existing_book.query_doc_pairs.find_by!(query_text: 'b').judgements.map(&:rating)
    end

    test 'progress is reported with the remaining count, percent and pair' do
      calls = []
      ProgressBroadcaster.singleton_class.alias_method :__orig_render, :render
      ProgressBroadcaster.define_singleton_method(:render) { |record, **opts| calls << [ record, opts[:locals] ] }
      begin
        BookImporter.new(existing_book, user, { query_doc_pairs: [
                           { query_text: 'a', doc_id: '1' }, { query_text: 'b', doc_id: '2' }
                         ] }).import
      ensure
        ProgressBroadcaster.singleton_class.alias_method :render, :__orig_render
        ProgressBroadcaster.singleton_class.remove_method :__orig_render
      end

      assert_equal([ [ 1, 50 ], [ 0, 100 ] ], calls.map { |_record, locals| [ locals[:counter], locals[:percent] ] })
      assert_equal(%w[a b], calls.map { |_record, locals| locals[:qdp].query_text })
      assert(calls.all? { |record, _locals| record == existing_book })
    end

    test 'import returns true even when pairs were imported without judgements' do
      assert BookImporter.new(existing_book, user, { query_doc_pairs: [ { query_text: 'a', doc_id: '1' } ] }).import
    end

    test 'sync jobs for the whole import are batched into one' do
      assert_enqueued_jobs 1, only: UpdateCaseRatingsJob do
        BookImporter.new(existing_book, user, { query_doc_pairs: [
                           { query_text: 'a', doc_id: '1', judgements: [ { rating: 1, user_id: user.id } ] },
                           { query_text: 'b', doc_id: '2', judgements: [ { rating: 1, user_id: user.id } ] }
                         ] }).import
      end
    end

    test 'a persisted pair is found by id and then by text, and a new pair joins the book' do
      pair = existing_book.query_doc_pairs.create!(query_text: 'a', doc_id: '1')
      BookImporter.new(existing_book, user, { query_doc_pairs: [
                         { query_doc_pair_id: pair.id, query_text: 'renamed', doc_id: '1' },
                         { query_text: 'new', doc_id: '9' }
                       ] }).import

      assert_equal 'renamed', pair.reload.query_text
      assert_equal existing_book, existing_book.query_doc_pairs.find_by!(query_text: 'new').book
    end
  end

  describe 'null and blank values in the payload' do
    let(:existing_book) { Book.create!(name: 'Existing Book', owner: doug, scale: [ 0, 1, 2 ], scale_with_labels: { '0' => 'Old' }) }

    test 'a nil scorer falls through to the top level scale' do
      BookImporter.new(existing_book, user, { scorer: nil, scale: [ 0, 1 ] }).import

      assert_equal [ 0, 1 ], existing_book.reload.scale
    end

    test 'a nil scale does not clear the existing scale' do
      BookImporter.new(existing_book, user, { scale: nil }).import

      assert_equal [ 0, 1, 2 ], existing_book.reload.scale
    end

    test 'blank labels do not clear the existing labels' do
      BookImporter.new(existing_book, user, { scale: [ 0, 1, 2 ], scale_with_labels: {} }).import
      assert_equal({ '0' => 'Old' }, existing_book.reload.scale_with_labels)

      BookImporter.new(existing_book, user, { scorer: { scale: [ 0, 1, 2 ], scale_with_labels: {} } }).import
      assert_equal({ '0' => 'Old' }, existing_book.reload.scale_with_labels)
    end

    test 'nil query_doc_pairs and nil judgements are treated as absent' do
      assert BookImporter.new(existing_book, user, { query_doc_pairs: nil }).import
      assert BookImporter.new(existing_book, user, { query_doc_pairs: [ { query_text: 'q', doc_id: '1', judgements: nil } ] }).import
    end

    test 'a pair without query text is skipped instead of raising' do
      assert_no_difference 'QueryDocPair.count' do
        BookImporter.new(existing_book, user, { query_doc_pairs: [ { doc_id: '1' } ] }).import
      end
    end

    test 'an invalid nested pair makes the judgement unusable even when the rating is valid' do
      importer = BookImporter.new(existing_book, user, { all_judgements: [ { query_doc_pair: { query_text: 'no doc id' }, rating: 1 } ] })
      importer.validate

      assert_equal 1, existing_book.errors[:base].size
    end

    test 'an empty query_doc_pairs list still validates standalone judgements' do
      importer = BookImporter.new(existing_book, user, { all_judgements: [ { rating: 1 } ], query_doc_pairs: [] })
      importer.validate

      assert_equal 1, existing_book.errors[:base].size
    end

    test 'a blank email never matches a user with a blank stored email' do
      nobody = users(:random_1)
      nobody.update_column(:email, '')
      pair = existing_book.query_doc_pairs.create!(query_text: 'q', doc_id: '1')

      BookImporter.new(existing_book, user, { all_judgements: [
                         { query_doc_pair_id: pair.id, email: '   ', rating: 1 },
                         { query_doc_pair_id: pair.id, email: nil, rating: 2 }
                       ] }).import

      assert_equal [ nil, nil ], pair.judgements.map(&:user)
    end
  end
end
