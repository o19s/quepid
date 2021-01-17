# frozen_string_literal: true

module DeviseHelper
  def devise_error_messages!
    return '' if resource.errors.empty?

    messages = resource.errors.full_messages.map { |msg| tag(:li, msg) }.join
    sentence = I18n.t('errors.messages.not_saved',
                      count:    resource.errors.count,
                      resource: resource.class.model_name.human.downcase)

    html = <<-HTML
    <div id="error_explanation" class="alert alert-danger">
      <h2>#{sentence}</h2>
      <ul>#{messages}</ul>
    </div>
    HTML

    html.html_safe # rubocop:disable Rails/OutputSafety
  end

  def devise_error_messages?
    resource.errors.empty? ? false : true
  end

  def devise_reset_password_error_messages
    return '' if resource.errors.empty?

    messages = resource.errors.messages.map do |attribute, msgs|
      message = msgs.first.gsub('\'', '').gsub(' ', '_').downcase
      I18n.t("errors.messages.reset_password.#{attribute}.#{message}")
    end
    sentence = I18n.t('errors.messages.reset_password.not_sent')
    sentence << " #{messages.join(', ')}"

    html = <<-HTML
    <div id="error_explanation" class="alert alert-danger">
      <p>#{sentence}</p>
    </div>
    HTML

    html.html_safe # rubocop:disable Rails/OutputSafety
  end

  def devise_update_password_error_messages
    return '' if resource.errors.empty?

    messages = resource.errors.messages.map do |attribute, msgs|
      message = msgs.first.gsub('\'', '').gsub(' ', '_').downcase
      I18n.t("errors.messages.update_password.#{attribute}.#{message}")
    end
    sentence = I18n.t('errors.messages.update_password.not_saved')
    sentence << " #{messages.join(', ')}"

    html = <<-HTML
    <div id="error_explanation" class="alert alert-danger">
      <p>#{sentence}</p>
    </div>
    HTML

    html.html_safe # rubocop:disable Rails/OutputSafety
  end
end
