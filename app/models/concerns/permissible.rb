# frozen_string_literal: true

# rubocop:disable Metrics/ModuleLength
module Permissible
  extend ActiveSupport::Concern

  PERMISSIONS = [
    {
      model_type: 'case',
      action:     'create',
      on:         { user: true },
    },
    {
      model_type: 'case',
      action:     'create_multi',
      on:         { user: true },
    },
    {
      model_type: 'case',
      action:     'update',
      on:         { user: true },
    },
    {
      model_type: 'case',
      action:     'read',
      on:         { user: true },
    },
    {
      model_type: 'case',
      action:     'delete',
      on:         { user: true },
    },
    {
      model_type: 'query',
      action:     'create',
      on:         { user: true },
    },
    {
      model_type: 'query',
      action:     'update',
      on:         { user: true },
    },
    {
      model_type: 'query',
      action:     'read',
      on:         { user: true },
    },
    {
      model_type: 'query',
      action:     'delete',
      on:         { user: true },
    },
    {
      model_type: 'scorer',
      action:     'create',
      on:         { user: true },
    },
    {
      model_type: 'scorer',
      action:     'update',
      on:         { user: true },
    },
    {
      model_type: 'scorer',
      action:     'update_communal',
      on:         { user: true },
    },
    {
      model_type: 'scorer',
      action:     'read',
      on:         { user: true },
    },
    {
      model_type: 'scorer',
      action:     'delete',
      on:         { user: true },
    },
    {
      model_type: 'snapshot',
      action:     'create',
      on:         { user: true },
    },
    {
      model_type: 'snapshot',
      action:     'update',
      on:         { user: true },
    },
    {
      model_type: 'snapshot',
      action:     'read',
      on:         { user: true },
    },
    {
      model_type: 'snapshot',
      action:     'delete',
      on:         { user: true },
    },
    {
      model_type: 'team',
      action:     'create',
      on:         { user: true },
    },
    {
      model_type: 'team',
      action:     'update',
      on:         { user: true },
    },
    {
      model_type: 'team',
      action:     'read',
      on:         { user: true },
    },
    {
      model_type: 'team',
      action:     'delete',
      on:         { user: true },
    },
    {
      model_type: 'try',
      action:     'create',
      on:         { user: true },
    },
    {
      model_type: 'try',
      action:     'update',
      on:         { user: true },
    },
    {
      model_type: 'try',
      action:     'read',
      on:         { user: true },
    },
    {
      model_type: 'try',
      action:     'delete',
      on:         { user: true },
    },
    {
      model_type: 'user',
      action:     'create',
      on:         { user: false },
    },
    {
      model_type: 'user',
      action:     'update',
      on:         { user: true },
    },
    {
      model_type: 'user',
      action:     'read',
      on:         { user: true },
    },
    {
      model_type: 'user',
      action:     'delete',
      on:         { user: false },
    }
  ].freeze

  def self.grouped_permissions
    PERMISSIONS.each_with_object({}) do |permission, grouped|
      model_type = permission[:model_type].to_sym
      grouped[model_type] ||= {}
      grouped[model_type][permission[:action].to_sym] = permission[:on]
    end
  end

  def self.defaults
    PERMISSIONS.each_with_object({}) do |permission, grouped|
      model_type = permission[:model_type].to_sym
      grouped[model_type] ||= {}
      grouped[model_type][permission[:action].to_sym] = permission[:on][:user]
    end
  end

  included do
    before_save :set_default_permissions
  end

  def set_user_default_permissions
    set_permissions level: :user
  end

  def fetch_permission model_type, action
    permissions.find_by(
      model_type: model_type,
      action:     action
    )
  end

  # rubocop:disable Naming/PredicateName
  def has_permission? model_type, action
    permissions.exists?(model_type: model_type, action: action)
  end
  # rubocop:enable Naming/PredicateName

  def permitted_to? model_type, action
    permission = fetch_permission model_type, action
    permission.on
  end

  def permissions_hash
    hash = {}

    permissions.each do |permission|
      hash[permission.model_type.to_sym] ||= {}
      hash[permission.model_type.to_sym][permission.action.to_sym] = permission.on
    end

    hash
  end

  private

  def set_default_permissions
    set_user_default_permissions if new_record?

    true
  end

  # rubocop:disable Naming/AccessorMethodName
  # rubocop:disable Metrics/MethodLength
  def set_permissions level: :user
    PERMISSIONS.each do |permission|
      existing = fetch_permission permission[:model_type], permission[:action]

      if existing.present?
        existing.update on: permission[:on][level]
      elsif persisted?
        permissions.create(
          model_type: permission[:model_type],
          action:     permission[:action],
          on:         permission[:on][level]
        )
      else
        permissions.build(
          model_type: permission[:model_type],
          action:     permission[:action],
          on:         permission[:on][level]
        )
      end
    end
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Naming/AccessorMethodName
end
# rubocop:enable Metrics/ModuleLength
