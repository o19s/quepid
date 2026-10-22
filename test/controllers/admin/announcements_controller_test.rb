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

    test 'index renders announcement HTML but strips scripts and event handlers' do
      announcement.update!(text: '<a href="https://example.com" onclick="steal()">Notes</a><script>alert(1)</script>')

      get :index

      assert_response :success
      assert_select 'td a[href="https://example.com"]', text: 'Notes'
      assert_select 'td a[onclick]', count: 0
      assert_select 'td script', count: 0
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

    test 'update with a valid date range redirects back to the edit preview' do
      patch :update, params: {
        id:           announcement,
        announcement: { publish_date: Date.current, expiration_date: 2.days.from_now.to_date },
      }

      assert_response :see_other
      assert_redirected_to edit_admin_announcement_path(announcement)

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

    test 'index filters announcements by text' do
      get :index, params: { q: 'new Scorer' }

      assert_response :success
      assert_select 'td', text: /We have a new Scorer/
      assert_select 'td', text: /already expired/, count: 0
    end

    test 'new proposes a blank announcement published tomorrow and expiring in a month' do
      get :new

      assert_response :success
      assert_equal '', assigns(:announcement).text
      assert_equal 1.day.from_now.to_date, assigns(:announcement).publish_date
      assert_equal 30.days.from_now.to_date, assigns(:announcement).expiration_date
    end

    test 'edit loads the announcement' do
      get :edit, params: { id: announcement }

      assert_response :success
      assert_equal announcement, assigns(:announcement)
    end

    test 'create saves the announcement under the signed-in admin and opens it for preview' do
      assert_difference 'Announcement.count', 1 do
        post :create, params: {
          announcement: { text: 'Maintenance tonight', author_id: users(:random).id,
                          publish_date: Date.current, expiration_date: 3.days.from_now.to_date },
        }
      end

      created = Announcement.find_by(text: 'Maintenance tonight')
      assert_redirected_to edit_admin_announcement_path(created)
      assert_response :see_other
      assert_equal admin, created.author
    end

    test 'create without text does not save' do
      assert_no_difference 'Announcement.count' do
        post :create, params: {
          announcement: { text: '', publish_date: Date.current, expiration_date: 3.days.from_now.to_date },
        }
      end

      assert_response :unprocessable_content
      assert_template :new
    end

    test 'update with text that is too long shows the error and keeps the old text' do
      original = announcement.text

      patch :update, params: { id: announcement, announcement: { text: 'x' * 1025 } }

      assert_response :unprocessable_content
      assert_template :edit
      assert_equal original, announcement.reload.text
    end

    test 'destroy removes the announcement and returns to the list' do
      assert_difference 'Announcement.count', -1 do
        delete :destroy, params: { id: announcement }
      end

      assert_redirected_to admin_announcements_path
      assert_response :see_other
    end

    test 'returns not found for an announcement that does not exist' do
      get :edit, params: { id: 0 }

      assert_response :not_found
    end

    test 'a non-administrator cannot manage announcements' do
      login_user users(:random)

      assert_no_difference 'Announcement.count' do
        delete :destroy, params: { id: announcement }
      end

      assert_redirected_to root_path
    end
  end
end
