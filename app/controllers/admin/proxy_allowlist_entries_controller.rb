# frozen_string_literal: true

module Admin
  # Admin-managed additions to the proxy allowlist. Only available when
  # PROXY_ALLOWLIST_ADMIN_MANAGED is on; see ProxyAllowlist.
  class ProxyAllowlistEntriesController < Admin::AdminController
    before_action :require_admin_managed_allowlist
    before_action :set_entry, only: [ :edit, :update, :destroy ]

    def index
      @entries = ProxyAllowlistEntry.includes(:created_by, :updated_by).order(:kind, :value)
      @env_networks = Rails.application.config.proxy_allowed_networks
      @env_hosts = Rails.application.config.proxy_allowed_hosts
    end

    def new
      @entry = ProxyAllowlistEntry.new(kind: ProxyAllowlistEntry::NETWORK)
    end

    def edit; end

    def create
      @entry = ProxyAllowlistEntry.new(params.expect(proxy_allowlist_entry: [ :kind, :value, :note ]))
      @entry.created_by = current_user
      @entry.updated_by = current_user

      if @entry.save
        log_change "created #{@entry.kind} #{@entry.value}"
        redirect_to admin_proxy_allowlist_entries_path, notice: "Added #{@entry.value}.", status: :see_other
      else
        render 'new', status: :unprocessable_content
      end
    end

    def update
      @entry.assign_attributes(params.expect(proxy_allowlist_entry: [ :value, :note ]))
      @entry.updated_by = current_user

      if @entry.save
        log_change "updated #{@entry.kind} #{@entry.value_before_last_save} → #{@entry.value}"
        redirect_to admin_proxy_allowlist_entries_path, notice: "Updated #{@entry.value}.", status: :see_other
      else
        render 'edit', status: :unprocessable_content
      end
    end

    def destroy
      @entry.destroy!
      log_change "deleted #{@entry.kind} #{@entry.value}"
      redirect_to admin_proxy_allowlist_entries_path, notice: "Removed #{@entry.value}.", status: :see_other
    end

    private

    def require_admin_managed_allowlist
      return if Rails.application.config.proxy_allowlist_admin_managed

      render file: Rails.public_path.join('404.html'), status: :not_found, layout: false
    end

    def set_entry
      @entry = ProxyAllowlistEntry.find(params.expect(:id))
    end

    def log_change description
      Rails.logger.info("[proxy_allowlist] #{description} by user #{current_user.id} <#{current_user.email}>")
    end
  end
end
