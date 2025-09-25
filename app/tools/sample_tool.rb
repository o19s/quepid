# frozen_string_literal: true

class SampleTool < ApplicationTool
  description 'Greet a user'

  arguments do
    required(:id).filled(:integer).description('ID of the user to greet')
    optional(:prefix).filled(:string).description('Prefix to add to the greeting')
  end

  def call(id:, prefix: 'Hey')
    puts "HI "
    puts "llokign for user with id #{id}"
    user = User.find(id)

    "#{prefix} #{user.name} !"
  end
end
