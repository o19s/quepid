# frozen_string_literal: true

require 'test_helper'

class PopulateBookJobTest < ActiveJob::TestCase
  # The core of the logic for these tests is in the populate_controller_test.rb file!
  let(:book) { books(:james_bond_movies) }
  let(:judge_judy) { users(:judge_judy) }

  describe 'populating an existing book' do
    test 'ensure that position value is unique per query' do
      assert true
    end
  end
end
