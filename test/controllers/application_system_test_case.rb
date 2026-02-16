# frozen_string_literal: true

require 'test_helper'

# Register headless Chrome with options that work in Docker (no-sandbox, disable-dev-shm-usage).
# Without these, Chrome exits immediately and Selenium raises SessionNotCreatedError.
Capybara.register_driver :headless_chrome do |app|
  options = Selenium::WebDriver::Chrome::Options.new
  options.add_argument('--headless=new')
  options.add_argument('--no-sandbox')
  options.add_argument('--disable-dev-shm-usage')
  options.add_argument('--disable-gpu')
  options.add_argument('--disable-software-rasterizer')
  options.add_argument('--window-size=1400,1400')
  # Use Chromium installed in Docker (Dockerfile.dev installs chromium)
  options.binary = '/usr/bin/chromium' if File.exist?('/usr/bin/chromium')
  Capybara::Selenium::Driver.new(app, browser: :chrome, options: options)
end

class ApplicationSystemTestCase < ActionDispatch::SystemTestCase
  driven_by :selenium, using: :headless_chrome, screen_size: [ 1400, 1400 ]
end
