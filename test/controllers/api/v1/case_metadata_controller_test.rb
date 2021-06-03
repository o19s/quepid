# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class CaseMetadataControllerTest < ActionController::TestCase
      let(:user) { users(:random) }

      before do
        @controller = Api::V1::CaseMetadataController.new

        login_user user
      end

      describe 'Updates case metadata' do
        let(:acase) { cases(:metadata_case) }

        test 'sets the last viewed at to the date passed' do
          date        = DateTime.current
          date_param  = date.strftime('%F %T')

          put :update, params: { case_id: acase.id, metadata: { last_viewed_at: date_param } }

          assert_response :no_content

          metadatum = acase.metadata.where(user_id: user.id).first
          last_viewed_at = metadatum.last_viewed_at.strftime('%F %T')

          assert_equal date.strftime('%F %T'), last_viewed_at
        end

        test 'updates existing metadatum and does not create a new one' do
          old_date = DateTime.current - 2.days
          acase.metadata.create(last_viewed_at: old_date, user_id: user.id)

          date        = DateTime.current
          date_param  = date.strftime('%F %T')

          put :update, params: { case_id: acase.id, metadata: { last_viewed_at: date_param } }

          assert_response :no_content

          metadatum = acase.metadata.where(user_id: user.id).first
          last_viewed_at = metadatum.last_viewed_at.strftime('%F %T')

          assert_equal      date.strftime('%F %T'),     last_viewed_at
          assert_not_equal  old_date.strftime('%F %T'), last_viewed_at

          assert_equal      1, acase.metadata.where(user_id: user.id).count
        end
      end
    end
  end
end
