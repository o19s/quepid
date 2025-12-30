# frozen_string_literal: true

class MapperWizardCleanupJob < ApplicationJob
  queue_as :default

  def perform older_than: 1.day.ago
    MapperWizardState.cleanup_old_states(older_than)
  end
end
