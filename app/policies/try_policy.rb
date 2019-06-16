# frozen_string_literal: true

class TryPolicy < ApplicationPolicy
  attr_reader :user, :record

  def initialize user, record
    @user   = user
    @record = record
  end

  def index?
    true
  end

  def show?
    permissions[:read]
  end

  def create?
    permissions[:create]
  end

  def new?
    create?
  end

  def update?
    permissions[:update] && show?
  end

  def edit?
    update?
  end

  def destroy?
    permissions[:delete]
  end

  private

  def permissions
    @user.permissions_hash[:try] || Permissible.defaults[:try]
  end
end
