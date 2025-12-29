# frozen_string_literal: true

require 'faraday'
require 'nokogiri'

class DownloadPage < RubyLLM::Tool
  description 'Downloads a specific web search results page'
  param :url, desc: 'Webpage Search Results URL (e.g., https://search.ed.ac.uk/?q=mental)'

  # rubocop:disable Metrics/MethodLength
  def execute url:
    # Validate URL format
    return { error: 'Invalid URL format. Must start with http:// or https://' } unless url&.match?(%r{\Ahttps?://.+}i)

    response = Faraday.get(url) do |req|
      req.options.timeout = 30        # 30 second timeout
      req.options.open_timeout = 10   # 10 second connection timeout
      req.headers['User-Agent'] = 'Quepid/1.0 (Web Scraper)'
    end

    # Check for successful response
    return { error: "HTTP #{response.status}: Failed to fetch URL" } unless response.success?

    # Check if we got content
    return { error: 'No content received from URL' } if response.body.blank?

    data = response.body
    # assuming it's html not json
    clean_html = strip_css_styling(data)
    clean_html
  rescue Faraday::TimeoutError
    { error: 'Request timed out' }
  rescue Faraday::ConnectionFailed
    { error: 'Connection failed - unable to reach URL' }
  rescue StandardError => e
    { error: e.message }
  end
  # rubocop:enable Metrics/MethodLength

  private

  def strip_css_styling html
    doc = Nokogiri::HTML(html)

    # Remove all style tags
    doc.css('style').remove

    # Remove all link tags that reference stylesheets
    doc.css('link[rel="stylesheet"]').remove

    # Remove inline style attributes from all elements
    doc.css('[style]').each do |element|
      element.remove_attribute('style')
    end

    # Remove class attributes (optional, but often used for styling)
    doc.css('[class]').each do |element|
      element.remove_attribute('class')
    end

    # Remove JavaScript
    doc.css('script').remove                     # Remove script tags
    doc.xpath('//@*[starts-with(name(), "on")]').each(&:remove)
    doc.css('[href^="javascript:"]').each do |el|
      el.remove_attribute('href')                # Remove javascript: URLs
    end

    # Return the cleaned HTML
    doc.to_html
  end
end
