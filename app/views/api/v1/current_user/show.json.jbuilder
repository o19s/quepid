# frozen_string_literal: true

json.partial! 'api/v1/users/user', user: @user
json.permissions     @permissions
