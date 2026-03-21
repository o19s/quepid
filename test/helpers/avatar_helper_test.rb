# frozen_string_literal: true

require 'test_helper'

class AvatarHelperTest < ActionView::TestCase
  include AvatarHelper

  describe '#avatar_tag' do
    describe 'with a user that has profile_pic' do
      setup do
        @user = users(:random)
        @user.profile_pic = 'https://example.com/avatar.jpg'
        @user.save!
      end

      test 'renders image with profile pic URL' do
        result = avatar_tag(@user)
        assert_includes result, 'https://example.com/avatar.jpg'
        assert_includes result, @user.fullname
      end

      test 'respects size parameter' do
        result = avatar_tag(@user, size: :small)
        assert_includes result, 'width:24px'
        assert_includes result, 'height:24px'
      end
    end

    describe 'with AI judge user' do
      setup do
        @ai_judge = users(:judge_judy)
      end

      test 'includes robot badge for AI judge' do
        result = avatar_tag(@ai_judge)
        assert_includes result, 'bi-robot'
        assert_includes result, 'AI Judge'
        assert_includes result, 'aria-label'
      end
    end

    describe 'with regular user' do
      setup do
        @user = users(:random)
      end

      test 'does not include robot badge' do
        result = avatar_tag(@user)
        assert_not_includes result, 'bi-robot'
      end

      test 'always wraps in positioned div' do
        result = avatar_tag(@user)
        assert_includes result, 'position-relative'
        assert_includes result, 'd-inline-block'
      end
    end

    describe 'with nil user' do
      test 'returns placeholder without error' do
        result = avatar_tag(nil)
        assert_includes result, 'avatar-placeholder'
        assert_includes result, '?'
      end
    end

    describe 'with custom classes' do
      setup do
        @user = users(:random)
      end

      test 'applies custom classes to wrapper' do
        result = avatar_tag(@user, classes: 'me-3 custom-class')
        assert_includes result, 'me-3'
        assert_includes result, 'custom-class'
      end
    end

    describe 'size handling' do
      setup do
        @user = users(:random)
      end

      test 'defaults to medium size' do
        result = avatar_tag(@user)
        assert_includes result, '48px'
      end

      test 'handles invalid size by defaulting to medium' do
        result = avatar_tag(@user, size: :invalid)
        assert_includes result, '48px'
      end
    end
  end
end
