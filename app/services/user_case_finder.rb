# frozen_string_literal: true

class UserCaseFinder
  attr_accessor :user, :cases

  def initialize user
    @user = user
    @cases = Case.includes(:metadata, teams: [ :members ])
      .references(:teams, :users, :metadata)
      .for_user(@user)
  end

  def method_missing method_name, *arguments, &block
    if @cases.respond_to? method_name
      @cases.send(method_name, *arguments, &block)
    else
      super
    end
  end

  def respond_to_missing? method_name, include_private = false
    @cases.respond_to?(method_name) || super
  end
end
