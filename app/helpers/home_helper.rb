# frozen_string_literal: true

module HomeHelper
  def greeting
    greetings = [
      "G'Day",
      'Hello',
      "How's your day?",
      'Good to see you',
      'So good to see you',
      'Hiya!',
      'Bonjour',
      'Hola!',
      'こんにちは',
      '你好',
      'नमस्ते',
      'Guten Tag'
    ]
    greetings.sample
  end

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  def greeting2
    current_time = DateTime.current.seconds_since_midnight
    midnight = DateTime.now.beginning_of_day.seconds_since_midnight
    noon = DateTime.now.middle_of_day.seconds_since_midnight
    five_pm = DateTime.now.change(:hour => 17 ).seconds_since_midnight
    eight_pm = DateTime.now.change(:hour => 20 ).seconds_since_midnight

    puts "DateTime.current #{DateTime.current}"
    puts "midnight: #{midnight}"
    puts "noon: #{noon}"
    puts "current_time: #{current_time}"

    if midnight.upto(noon).include?(current_time)
      greeting = 'Good Morning'
    elsif noon.upto(five_pm).include?(current_time)
      greeting = 'Good Afternoon'
    elsif five_pm.upto(eight_pm).include?(current_time)
      greeting = 'Good Evening'
    elsif eight_pm.upto(midnight + 1.day).include?(current_time)
      greeting = 'Good Night'
    end
    greeting
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength

  def strip_case_title kase
    kase.case_name.sub(/^case\s+/i, '').capitalize
  end
end
