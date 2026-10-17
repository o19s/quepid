# frozen_string_literal: true

require 'digest'
require 'json'

namespace :test do
  desc 'Render wizard HTML for the database-free Stimulus wiring tests'
  task render_wizard_fixture: :environment do
    sources = %w[
      app/views/shared/_wizard_modal.html.erb app/views/shared/_wizard_engine_tile.html.erb config/routes.rb
    ]
    original = Rails.application.config.require_proxy_for_all_search_endpoints
    renderer = ApplicationController.renderer.new(http_host: 'www.example.com', https: false)
    fixture = {
      sources: sources.index_with { |path| Digest::SHA256.file(Rails.root.join(path)).hexdigest },
    }

    begin
      { default: false, proxy_required: true }.each do |name, required|
        Rails.application.config.require_proxy_for_all_search_endpoints = required
        html = renderer.render(partial: 'shared/wizard_modal', locals: { kase: Case.new(id: 123) })
        fixture[name] = "wizard_#{name}.html"
        File.write(Rails.root.join('test/fixtures/files', fixture[name]), html)
      end
      File.write(Rails.root.join('test/fixtures/files/wizard_markup.json'), "#{JSON.pretty_generate(fixture)}\n")
    ensure
      Rails.application.config.require_proxy_for_all_search_endpoints = original
    end
  end
end
