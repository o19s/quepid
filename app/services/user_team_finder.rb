# frozen_string_literal: true

class UserTeamFinder
  attr_accessor :user

  def initialize user
    @user = user
  end

  def call
    Team.references(:users)
      .for_user(@user)
  end
end
