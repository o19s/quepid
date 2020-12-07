# frozen_string_literal: true

module ApplicationHelper
  def bootstrap_class_for flash_type
    {
      success: 'alert-success',
      error:   'alert-danger',
      alert:   'alert-warning',
      notice:  'alert-info',
    }[flash_type.to_sym] || flash_type.to_s
  end

  # rubocop:disable Metrics/MethodLength
  def flash_messages _opts = {}
    flash.each do |msg_type, message|
      concat(
        tag(
          :div,
          message,
          class: "alert #{bootstrap_class_for(msg_type)} alert-dismissible",
          role:  'alert'
        ) do
          concat(
            tag(
              :button,
              class: 'close',
              data:  { dismiss: 'alert' }
            ) do
              concat(
                tag(:span, '&times;'.html_safe, 'aria-hidden' => true)
              )
              concat tag(:span, 'Close', class: 'sr-only')
            end
          )
          concat message
        end
      )
    end

    nil
  end
  # rubocop:enable Metrics/MethodLength

  def make_csv_safe str
    if %w[- = + @].include?(str[0])
      " #{str}"
    else
      str
    end
  end
end
