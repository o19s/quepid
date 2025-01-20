# frozen_string_literal: true

Rails.application.console do
  def wcw val
    puts "Val: #{val}"
    pp val
  end
end
