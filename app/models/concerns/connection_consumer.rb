# frozen_string_literal: true

# What a record that calls out through a Connection (an embedder, an AI judge) checks about the
# connection it is given, whatever it uses it for (ADR 0005 §2.5). The including model defines
# `connection_problem`: why its connection doesn't fit it (wrong capability, wrong provider), or nil.
#
# Teams share the configured consumer, not the connection: a teammate may use and edit a shared
# consumer on its existing connection, but may only attach a connection that both they and the
# consumer's owner can select.
module ConnectionConsumer
  extend ActiveSupport::Concern

  included do
    # Request context only; the owner-access check still applies when no assigning user is set.
    attr_accessor :connection_assignment_user

    validate :connection_fits_and_is_usable
    validate :connection_accessible_to_assigner
    validate :connection_not_removed, on: :update
  end

  private

  # The user saving the record must be able to select a new or different connection; an unchanged
  # one stays allowed, so someone using a shared consumer needn't have access to its connection.
  def connection_accessible_to_assigner
    return if connection_assignment_user.nil?
    return if connection_id.nil? || !connection_id_changed?
    return if connection_assignment_user.connections_involved_with.exists?(id: connection_id)
    return if errors.added?(:connection, "isn't one you can use")

    errors.add(:connection, "isn't one you can use")
  end

  # A consumer on a connection can move to another, but not back to settings of its own, which
  # the forms no longer have.
  def connection_not_removed
    return unless connection_id.nil? && connection_id_was.present?

    errors.add(:connection, 'can be changed but not removed')
  end

  def connection_fits_and_is_usable
    return unless connection

    problem = connection_problem
    errors.add(:connection, problem) if problem
  end

  # An unchanged connection stays allowed, so renaming never trips over access that was withdrawn
  # later; picking a new one needs the owner to be able to use it.
  def connection_usable_by_owner?
    !connection_id_changed? || owner&.connections_involved_with&.exists?(id: connection_id)
  end
end
