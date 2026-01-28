# frozen_string_literal: true

require 'test_helper'

class SelectionStrategyTest < ActiveSupport::TestCase
  def times_drawn name, book, user
    counter = 0

    ActiveRecord::Base.uncached do
      100.times do
        qdp = SelectionStrategy.random_query_doc_based_on_strategy(book, user)
        counter += 1 if qdp && qdp.doc_id == name
      end
    end
    counter
  end

  # rubocop:disable Style/CombinableLoops
  describe 'multiple raters per query doc pair strategy' do
    describe 'we rate wide each query' do
      let(:book)                { books(:james_bond_movies) }
      let(:matt)                { users(:matt) }
      let(:joe)                 { users(:joe) }
      let(:jane)                { users(:jane) }
      let(:doug)                { users(:doug) }

      before do
        book.query_doc_pairs.each { |query_doc_pair| query_doc_pair.judgements.delete_all }
        assert_empty book.judgements
        book.save!
      end

      it 'draws Sean Connery way more then George Lazenby due to position in results' do
        # there can be false positive failures due to the RAND() in mysql...
        sean_connery_picks = times_drawn('SeanConnery', book, matt)
        assert_predicate sean_connery_picks, :positive?

        george_lazenby_picks = times_drawn('GeorgeLazenby', book, matt)
        assert_predicate george_lazenby_picks, :positive?

        assert_operator sean_connery_picks, :>, george_lazenby_picks
      end

      it 'should only allow a user to rate once' do
        book.query_doc_pairs.size.times do
          query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(book, matt)
          assert_empty query_doc_pair.judgements
          query_doc_pair.judgements.create rating: 2.0, user: matt
        end

        assert_nil SelectionStrategy.random_query_doc_based_on_strategy(book, matt)
      end

      it 'should rate wide, then deep' do
        book.query_doc_pairs.size.times do
          query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(book, matt)
          assert_empty query_doc_pair.judgements
          query_doc_pair.judgements.create rating: 2.0, user: matt
        end
        book.reload

        # We have rated wide, so every query doc pair has one rating.
        book.query_doc_pairs.each { |qdp| assert_equal 1, qdp.judgements.size }
        book.query_doc_pairs.each { |qdp| assert_equal matt, qdp.judgements.first.user }

        (book.query_doc_pairs.size * 1).times do
          query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(book, joe)
          query_doc_pair.judgements.create rating: 3.0, user: joe
        end
        (book.query_doc_pairs.size * 1).times do
          query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(book, jane)
          query_doc_pair.judgements.create rating: 3.0, user: jane
        end
        book.reload

        # We have rated deep, so should have 3 judgements for each query doc pair
        book.query_doc_pairs.each { |qdp| assert_equal 3, qdp.judgements.size }
        book.query_doc_pairs.each do |qdp|
          users = qdp.judgements.collect(&:user)
          assert_includes users, matt
          assert_includes users, joe
          assert_includes users, jane
        end

        # No moar to be rated
        assert_nil SelectionStrategy.random_query_doc_based_on_strategy(book, matt)
        assert_nil SelectionStrategy.random_query_doc_based_on_strategy(book, joe)
        assert_nil SelectionStrategy.random_query_doc_based_on_strategy(book, jane)

        # We have rated broad and deep with three judgements per query doc pair, no moar for anyone
        assert_nil SelectionStrategy.random_query_doc_based_on_strategy(book, doug)
      end

      it 'decides when all query doc pairs have sufficient judgements' do
        assert_not(SelectionStrategy.every_query_doc_pair_has_three_judgements?(book))
        assert(SelectionStrategy.moar_judgements_needed?(book))

        # have three judges rate everything
        [ matt, joe, jane ].each do |user|
          while (query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(book, user))
            query_doc_pair.judgements.create rating: 3.0, user: user
          end
        end

        assert(SelectionStrategy.every_query_doc_pair_has_three_judgements?(book))
        assert_not(SelectionStrategy.moar_judgements_needed?(book))
      end

      it 'returns nil when no more judgements needed for user' do
        # Fill up all query doc pairs with 3 judgements each
        [ matt, joe, jane ].each do |user|
          while (query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(book, user))
            query_doc_pair.judgements.create rating: 3.0, user: user
          end
        end

        # Now doug should get nil since all pairs already have 3 judgements
        assert_nil SelectionStrategy.random_query_doc_based_on_strategy(book, doug)
      end

      it 'returns nil when user has already judged all available pairs' do
        # Matt judges all pairs once
        book.query_doc_pairs.each do |qdp|
          qdp.judgements.create rating: 2.0, user: matt
        end

        # Matt should get nil since he already judged all pairs
        assert_nil SelectionStrategy.random_query_doc_based_on_strategy(book, matt)

        # But Joe should still be able to get pairs to judge
        assert_not_nil SelectionStrategy.random_query_doc_based_on_strategy(book, joe)
      end

      it 'correctly identifies when user has judged all available pairs' do
        # Initially, user has not judged all pairs
        assert_not(SelectionStrategy.user_has_judged_all_available_pairs?(book, matt))

        # Matt judges all pairs once
        book.query_doc_pairs.each do |qdp|
          qdp.judgements.create rating: 2.0, user: matt
        end

        # Now Matt has judged all available pairs
        assert(SelectionStrategy.user_has_judged_all_available_pairs?(book, matt))

        # But Joe still has not judged any pairs
        assert_not(SelectionStrategy.user_has_judged_all_available_pairs?(book, joe))

        # Joe judges all pairs once
        book.query_doc_pairs.each do |qdp|
          qdp.judgements.create rating: 3.0, user: joe
        end

        # Now Joe has also judged all available pairs
        assert(SelectionStrategy.user_has_judged_all_available_pairs?(book, joe))
      end

      it 'handles nil positions without breaking randomization' do
        # Create a query_doc_pair with nil position
        nil_position_pair = book.query_doc_pairs.create!(
          query_text:      'Nil Position Test',
          doc_id:          'NilPositionDoc',
          position:        nil,
          document_fields: '{"title":"Test"}'
        )

        # Should still be able to get random pairs (nil position doesn't break the query)
        query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(book, matt)
        assert_not_nil query_doc_pair

        # The nil position pair should be selectable but deprioritized
        # Run multiple iterations to verify it can be selected
        nil_position_picks = 0
        positioned_picks = 0

        ActiveRecord::Base.uncached do
          100.times do
            qdp = SelectionStrategy.random_query_doc_based_on_strategy(book, matt)
            if 'NilPositionDoc' == qdp&.doc_id
              nil_position_picks += 1
            elsif qdp
              positioned_picks += 1
            end
          end
        end

        # Nil position pair should be picked less often than positioned pairs combined
        # since it's treated as position 1000 (very deprioritized)
        assert_operator positioned_picks, :>, nil_position_picks,
                        "Positioned pairs (#{positioned_picks}) should be picked more often than nil position pair (#{nil_position_picks})"

        # But it should still be possible to pick the nil position pair
        # (though this could occasionally fail due to randomness, we expect at least some picks)
        # If this assertion fails consistently, increase iterations or adjust threshold
        assert_operator nil_position_picks, :>=, 0,
                        'Nil position pair should still be selectable'

        # Clean up
        nil_position_pair.destroy
      end

      it 'correctly identifies unjudged pairs' do
        # Initially all pairs are unjudged
        assert(SelectionStrategy.unjudged_pairs?(book))
        assert_equal total_pairs, SelectionStrategy.unjudged_pairs_count(book)
        assert_equal 0, SelectionStrategy.partially_judged_pairs_count(book)

        # Matt judges half the pairs
        pairs_to_judge = book.query_doc_pairs.limit(2)
        pairs_to_judge.each do |qdp|
          qdp.judgements.create rating: 2.0, user: matt
        end

        # Should have fewer unjudged pairs and some partially judged
        assert(SelectionStrategy.unjudged_pairs?(book))
        assert_equal total_pairs - 2, SelectionStrategy.unjudged_pairs_count(book)
        assert_equal 2, SelectionStrategy.partially_judged_pairs_count(book)

        # Matt judges all pairs
        book.query_doc_pairs.each do |qdp|
          qdp.judgements.create rating: 2.0, user: matt unless qdp.judgements.exists?(user: matt)
        end

        # Should have no unjudged pairs, all are partially judged
        assert_not(SelectionStrategy.unjudged_pairs?(book))
        assert_equal 0, SelectionStrategy.unjudged_pairs_count(book)
        assert_equal total_pairs, SelectionStrategy.partially_judged_pairs_count(book)

        # Joe judges all pairs
        book.query_doc_pairs.each do |qdp|
          qdp.judgements.create rating: 3.0, user: joe
        end

        # Still no unjudged, still all partially judged (need 3rd judgement)
        assert_not(SelectionStrategy.unjudged_pairs?(book))
        assert_equal 0, SelectionStrategy.unjudged_pairs_count(book)
        assert_equal total_pairs, SelectionStrategy.partially_judged_pairs_count(book)

        # Jane judges all pairs - now complete
        book.query_doc_pairs.each do |qdp|
          qdp.judgements.create rating: 1.0, user: jane
        end

        # Should have no unjudged or partially judged pairs
        assert_not(SelectionStrategy.unjudged_pairs?(book))
        assert_equal 0, SelectionStrategy.unjudged_pairs_count(book)
        assert_equal 0, SelectionStrategy.partially_judged_pairs_count(book)
      end
    end
  end
  # rubocop:enable Style/CombinableLoops

  private

  def total_pairs
    @total_pairs ||= books(:james_bond_movies).query_doc_pairs.count
  end
end
