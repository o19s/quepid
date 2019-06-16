# frozen_string_literal: true

class CasePolicy < ApplicationPolicy
  attr_reader :user, :record

  def initialize user, record
    @user   = user
    @record = record
  end

  def index?
    true
  end

  def show?
    if @record.instance_of? Class
      permissions[:read]
    else
      permissions[:read] && ( @record.is_owner?(@user) || @record.shared_with?(@user) )
    end
  end

  def create?
    if @user.cases.not_archived.count.zero?
      permissions[:create]
    else
      permissions[:create_multi]
    end
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
    permissions[:delete] && @record.is_owner?(@user)
  end

  private

  def permissions
    @user.permissions_hash[:case] || Permissible.defaults[:case]
  end
end
