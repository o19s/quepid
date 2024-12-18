# frozen_string_literal: true

# == Schema Information
#
# Table name: books
#
#  id                          :bigint           not null, primary key
#  export_job                  :string(255)
#  import_job                  :string(255)
#  name                        :string(255)
#  populate_job                :string(255)
#  query_doc_pairs_count       :integer          default(0), not null
#  show_rank                   :boolean          default(FALSE)
#  support_implicit_judgements :boolean
#  created_at                  :datetime         not null
#  updated_at                  :datetime         not null
#  owner_id                    :integer
#  scorer_id                   :integer
#  selection_strategy_id       :bigint           not null
#
# Indexes
#
#  index_books_on_selection_strategy_id  (selection_strategy_id)
#
# Foreign Keys
#
#  fk_rails_...  (selection_strategy_id => selection_strategies.id)
#
require 'test_helper'

class BookTest < ActiveSupport::TestCase
  describe 'returning books for a user' do
    let(:user)                  { users(:random) }
    let(:team)                  { teams(:shared) }
    let(:book1)                 { books(:james_bond_movies) }
    let(:book2)                 { books(:empty_book) }

    # not sure this is actually important?  Why would we care at this level?
    # it 'returns books by alphabetical name of book for a team' do
    #  puts team.books.first.name
    #  puts team.books.second.name
    #  assert_equal book2, team.books.first
    #  assert_equal book1, team.books.second
    # end
  end

  describe 'sampling random query doc pairs' do
    let(:book) { books(:book_of_star_wars_judgements) }

    it 'returns a random query doc pair' do
      query_doc_pair_1 = book.query_doc_pairs.create query_text: 'star wars', doc_id: 'rogue_one'
      query_doc_pair_2 = book.query_doc_pairs.create query_text: 'star wars', doc_id: 'solo_story'

      random_query_doc_pair = SelectionStrategy.random_query_doc_pair_for_single_judge(book)
      assert_not_nil random_query_doc_pair
      assert(random_query_doc_pair == query_doc_pair_1 || random_query_doc_pair == query_doc_pair_2)
    end

    it 'doesnt return a rated query doc pair' do
      query_doc_pair_1 = book.query_doc_pairs.create query_text: 'star wars', doc_id: 'rogue_one'
      query_doc_pair_2 = book.query_doc_pairs.create query_text: 'star wars', doc_id: 'solo_story'

      query_doc_pair_1.judgements.create rating: 2.0

      # only one of two is a candidate, so sampling will return it every time.
      random_query_doc_pair = SelectionStrategy.random_query_doc_pair_for_single_judge(book)
      assert_equal query_doc_pair_2, random_query_doc_pair

      random_query_doc_pair = SelectionStrategy.random_query_doc_pair_for_single_judge(book)
      assert_equal query_doc_pair_2, random_query_doc_pair
    end

    it 'returns nil if there are none left' do
      query_doc_pair_1 = book.query_doc_pairs.create query_text: 'star wars', doc_id: 'rogue_one'
      query_doc_pair_2 = book.query_doc_pairs.create query_text: 'star wars', doc_id: 'solo_story'

      query_doc_pair_1.judgements.create rating: 2.0
      query_doc_pair_2.judgements.create rating: 2.0

      random_query_doc_pair = SelectionStrategy.random_query_doc_pair_for_single_judge(book)
      assert_nil random_query_doc_pair
    end
  end

  describe 'lifecycle of attachment to a book' do
    let(:book) { books(:book_of_star_wars_judgements) }

    it 'deletes the attachment when the book is destroyed' do
      json_file = generate_json_file
      assert_not book.import_file.present?
      assert_not book.import_file.attached?
      book.import_file.attach(io: File.open(json_file.path), filename: 'data.json')
      assert book.import_file.present?
      assert book.import_file.attached?

      import_file = book.import_file

      book.destroy

      assert_nil import_file.download

      json_file.unlink # get rid of temp file
    end
  end

  def generate_json_file
    data = {
      key1: 'Lorem ipsum dolor sit amet',
      key2: 'consectetur adipiscing elit',
      key3: 'sed do eiusmod tempor incididunt',
    }

    file = Tempfile.new([ 'data', '.json' ])
    file.write(data.to_json)
    file.close

    file
  end
end
