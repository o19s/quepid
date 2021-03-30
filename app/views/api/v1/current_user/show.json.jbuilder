# frozen_string_literal: true

json.partial! 'api/v1/users/user', user: @user
json.firstLogin      @user.first_login
json.permissions     @permissions
