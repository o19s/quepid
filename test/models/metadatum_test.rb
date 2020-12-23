# frozen_string_literal: true

# == Schema Information
#
# Table name: case_metadata
#
#  id             :integer          not null, primary key
#  user_id        :integer          not null
#  case_id        :integer          not null
#  last_viewed_at :datetime
#  ratings_view   :integer
#

require 'test_helper'

class MetadatumTest < ActiveSupport::TestCase
  describe 'ratings_view' do
    let(:acase)               { cases(:with_metadata) }
    let(:doug)                { users(:doug) }

    test 'can filter to a specific metadatum' do

      metadatum = acase.metadata.find_by(user_id: doug.id)
      assert_equal metadatum.ratings_view, 'individual'

      assert metadatum.individual_ratings_view?
      assert_not metadatum.consolidated_ratings_view?
    end
  end
end
