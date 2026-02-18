# frozen_string_literal: true

# Exports a case in the specified format and attaches the file to the case.
# Broadcasts Turbo Stream notifications when complete or on error.
# On failure, clears export_job so the case is not stuck in "export started" state.
#
# @see Core::ExportsController
# @see ExportCaseService
class ExportCaseJob < ApplicationJob
  queue_as :bulk_processing

  FORMATS = %w[general detailed snapshot quepid].freeze

  def perform(acase, format, snapshot_id: nil)
    acase.update(export_job: "export started at #{Time.zone.now}")

    broadcast_progress(acase, "Starting #{format} export...", 25)

    io, filename, content_type = generate_export(acase, format, snapshot_id)

    acase.export_file.attach(io: io, filename: filename, content_type: content_type)
    acase.update(export_job: nil)

    broadcast_complete(acase, filename)
  rescue StandardError => e
    acase.update(export_job: nil)
    broadcast_error(acase, e.message) if acase
    raise
  end

  private

  def generate_export(acase, format, snapshot_id)
    safe_name = acase.case_name.to_s.gsub(/[\s:]+/, '_')

    case format
    when 'general'
      rows, headers = ExportCaseService.general_csv(acase)
      csv_string = ExportCaseService.csv_string(rows, headers)
      [StringIO.new(csv_string), "#{safe_name}_general.csv", "text/csv"]
    when 'detailed'
      rows, headers = ExportCaseService.detailed_csv(acase)
      csv_string = ExportCaseService.csv_string(rows, headers)
      [StringIO.new(csv_string), "#{safe_name}_detailed.csv", "text/csv"]
    when 'snapshot'
      snapshot = acase.snapshots.find_by(id: snapshot_id)
      raise ActiveRecord::RecordNotFound, "Snapshot not found" unless snapshot

      rows, headers = ExportCaseService.snapshot_csv(acase, snapshot)
      csv_string = ExportCaseService.csv_string(rows, headers)
      [StringIO.new(csv_string), "#{safe_name}_snapshot.csv", "text/csv"]
    when 'quepid'
      json_data = ApplicationController.render(
        template: 'api/v1/export/cases/show',
        formats: [:json],
        assigns: { case: acase, current_user: acase.owner }
      )
      [StringIO.new(json_data), "#{safe_name}_case.json", "application/json"]
    else
      raise ArgumentError, "Unknown format: #{format}"
    end
  end

  def broadcast_progress(acase, message, progress)
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target: "notifications-case-#{acase.id}",
      partial: "core/exports/notification",
      locals: { acase: acase, message: message, progress: progress }
    )
  end

  def broadcast_complete(acase, filename)
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target: "notifications-case-#{acase.id}",
      partial: "core/exports/notification_complete",
      locals: { acase: acase, filename: filename }
    )
  end

  def broadcast_error(acase, message)
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target: "notifications-case-#{acase.id}",
      partial: "core/exports/notification_error",
      locals: { acase: acase, message: message }
    )
  end
end
