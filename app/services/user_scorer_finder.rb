# frozen_string_literal: true

class UserScorerFinder
  attr_accessor :user, :scorers

  def initialize user
    @user = user

    @scorers = Scorer.includes(teams: [ :members ])
      .references(:teams, :users)
      .for_user(@user)
  end

  def method_missing method_name, *arguments, &block
    if @scorers.respond_to? method_name
      @scorers.send(method_name, *arguments, &block)
    else
      super
    end
  end

  def respond_to_missing? method_name, include_private = false
    @scorers.respond_to?(method_name) || super
  end
end
