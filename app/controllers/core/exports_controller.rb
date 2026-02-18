# frozen_string_literal: true

# Handles case export from the web UI. Supports sync (direct download) and async
# (background job for large exports). API endpoints remain for external consumers.
#
# @see ExportCaseJob
module Core
  class ExportsController < ApplicationController
    include Authentication::CurrentUserManager
    include Authentication::CurrentCaseManager

    before_action :set_case_from_id
    before_action :set_try
    before_action :check_case

    respond_to :html, :turbo_stream

    ASYNC_FORMATS = %w[general detailed snapshot quepid].freeze

    # POST /case/:id/export
    # Queues export job for async formats; returns Turbo Stream with status.
    # Sync formats (information_need, basic, trec, rre, ltr) use GET links in the modal.
    def create
      format = params[:export_format] || params[:format]
      snapshot_id = params[:snapshot_id].presence

      unless ASYNC_FORMATS.include?(format)
        return render status: :unprocessable_entity, plain: "Unsupported format: #{format}"
      end

      if format == 'snapshot' && snapshot_id.blank?
        return render status: :unprocessable_entity, plain: "Snapshot required for snapshot export"
      end

      if @case.export_job.present?
        respond_to do |fmt|
          fmt.turbo_stream do
            render turbo_stream: turbo_stream.append(
              "flash",
              partial: "shared/flash_alert",
              locals: { message: "Export already in progress: #{@case.export_job}" }
            ), status: :unprocessable_entity
          end
          fmt.html { redirect_to case_core_path(@case, @try), alert: "Export already in progress" }
        end
        return
      end

      @case.export_file.purge if @case.export_file.attached?
      @case.update(export_job: "queued at #{Time.zone.now}")
      ExportCaseJob.perform_later(@case, format, snapshot_id: snapshot_id)

      respond_to do |fmt|
        fmt.turbo_stream do
          render turbo_stream: turbo_stream.append(
            "flash",
            partial: "shared/flash_alert",
            locals: { message: "Export started. You will be notified when it is ready." }
          ), status: :accepted
        end
        fmt.html { redirect_to case_core_path(@case, @try), notice: "Export started." }
      end
    end

    # GET /case/:id/export/download
    # Serves the exported file when ready (after job completes).
    def download
      unless @case.export_file.attached?
        redirect_to case_core_path(@case, @try), alert: "No export file available. Run an export first."
        return
      end

      redirect_to rails_blob_path(@case.export_file), allow_other_host: false
    end

    private

    def set_case_from_id
      params[:case_id] = params[:id]
      set_case
    end

    def set_try
      @try = @case.tries.latest
    end
  end
end
