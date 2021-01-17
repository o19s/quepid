# frozen_string_literal: true

class UserTeamFinder
  attr_accessor :user

  def initialize user
    @user = user
    @teams = Team.references(:users).for_user(@user)
  end

  def method_missing method_name, *arguments, &block
    if @teams.respond_to? method_name
      @teams.send(method_name, *arguments, &block)
    else
      super
    end
  end

  def respond_to_missing? method_name, include_private = false
    @teams.respond_to?(method_name) || super
  end
end
