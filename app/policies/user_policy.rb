# frozen_string_literal: true

class UserPolicy < ApplicationPolicy
  attr_reader :user, :record

  def initialize user, record
    @user   = user
    @record = record
  end

  def index?
    false
  end

  def show?
    if @record.instance_of? Class
      permissions[:read]
    else
      permissions[:read] && @record.id == @user.id
    end
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
    if @record.instance_of? Class
      permissions[:delete]
    else
      permissions[:delete] && @record.id == @user.id
    end
  end

  private

  def permissions
    @user.permissions_hash[:user] || Permissible.defaults[:user]
  end
end
