# frozen_string_literal: true

module ApplicationHelper
  def book_title book
    if book.name.downcase.starts_with?('book')
      book.name
    else
      "Book #{book.name}"
    end
  end

  def display_judge_name judge
    judge.nil? ? 'anonymous' : judge.fullname
  end

  def make_active? options
    if options.key?(:path)
      request.fullpath.include?(options[:path])
    elsif options.key?(:controller)
      controller_name == options[:controller]
    end
  end

  def bootstrap_class_for flash_type
    {
      success: 'alert-success',
      error:   'alert-danger',
      alert:   'alert-warning',
      notice:  'alert-info',
    }[flash_type.to_sym] || flash_type.to_s
  end

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Lint/EmptyBlock
  def flash_messages _opts = {}
    flash.each do |msg_type, message|
      next if 'unfurl' == msg_type # we don't show unfurl's in the flash notice UI.

      concat(
        content_tag(
          :div,
          message,
          class: "alert #{bootstrap_class_for(msg_type)} alert-dismissible fade show",
          role:  'alert'
        ) do
          concat(
            content_tag(
              :button,
              class: 'btn-close',
              data:  { 'bs-dismiss': 'alert' }
            ) do
            end
          )
          concat message
        end
      )
    end

    nil
  end
  # rubocop:enable Lint/EmptyBlock
  # rubocop:enable Metrics/MethodLength

  def document_fields_parses_as_json document_fields
    begin
      document_fields = JSON.parse document_fields
    rescue StandardError
      document_fields = nil
    end

    document_fields = nil unless document_fields.respond_to?(:keys)

    document_fields
  end

  # Override default form_for to disable Turbo Drive on
  # Forms.  Maybe should be an ENV variable?
  # caused by https on front end attempting to make http
  # call by Turbo Drive and getting mix mode errros
  def form_for record, options = {}, &

    if options[:html].nil?
      options[:html] = { data: { turbo: false } }
    elsif options[:html][:data].nil?
      options[:html][:data] = { turbo: false }
    end
    super
  end

  def form_with(model: nil, **options, &block)
    if options[:html].nil?
      options[:html] = { data: { turbo: false } }
    elsif options[:html][:data].nil?
      options[:html][:data] = { turbo: false }
    end

    # Call the original `form_with` method with the modified options
    super
  end
end
