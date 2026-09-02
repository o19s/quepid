# frozen_string_literal: true

require 'test_helper'

module Admin
  class AnnouncementsControllerTest < ActionController::TestCase
    let(:admin) { users(:doug) }
    let(:announcement) { announcements(:active_announcement) }

    setup do
      @controller = Admin::AnnouncementsController.new
      login_user admin
    end

    test 'update with an invalid date range does not save and shows the errors' do
      patch :update, params: {
        id:           announcement,
        announcement: { publish_date: Date.current, expiration_date: 1.day.ago.to_date },
      }

      assert_response :unprocessable_content
      assert_template :edit
      assert_includes assigns(:announcement).errors[:publish_date], 'must be on or before the expiration date'

      announcement.reload
      assert_not_equal 1.day.ago.to_date, announcement.expiration_date
    end

    test 'update with a valid date range saves and re-renders edit' do
      patch :update, params: {
        id:           announcement,
        announcement: { publish_date: Date.current, expiration_date: 2.days.from_now.to_date },
      }

      assert_response :success
      assert_template :edit

      announcement.reload
      assert_equal 2.days.from_now.to_date, announcement.expiration_date
    end

    test 'create with an invalid date range does not save and shows the errors' do
      assert_no_difference 'Announcement.count' do
        post :create, params: {
          announcement: { text: 'x', publish_date: Date.current, expiration_date: 1.day.ago.to_date },
        }
      end

      assert_response :unprocessable_content
      assert_template :new
      assert_includes assigns(:announcement).errors[:publish_date], 'must be on or before the expiration date'
    end
  end
end
