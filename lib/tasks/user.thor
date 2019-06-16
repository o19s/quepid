# frozen_string_literal: true

require 'colorize'

class User < Thor
  # rubocop:disable Metrics/MethodLength
  desc 'create USERNAME PASSWORD', 'creates a new user'
  long_desc <<-LONGDESC
    `user:create` creates a new user with the passed in username and password.

    EXAMPLES:

    $ thor user:create foo@example.com mysuperstrongpassword

    With -p option, will mark the user as paid

    EXAMPLES:

    $ thor user:create -p foo@example.com mysuperstrongpassword
  LONGDESC
  def create username, password
    puts "Creating a new user with username: #{username}, password: #{password}.".yellow

    load_environment

    user_params = {
      username:    username,
      password:    password,
      agreed_time: Time.zone.now,
      agreed:      true,
    }
    user = ::User.new(user_params)

    if user.save
      puts 'Success!'.green
    else
      puts 'Could not create user, check the errors below and try again:'.red
      user.errors.each do |attribute, message|
        puts "#{attribute} #{message}".red
      end
    end
  end
  # rubocop:enable Metrics/MethodLength

  desc 'reset_password USERNAME NEWPASSWORD', "resets user's password"
  long_desc <<-LONGDESC
    `user:reset_password` resets the user's password to the new password
    passed in.

    EXAMPLES:

    $ thor user:reset_password foo@example.com newpass
  LONGDESC
  def reset_password username, password
    puts "Resetting password for user with username: #{username}".yellow

    load_environment

    user = ::User.where(username: username).first

    unless user
      puts "Could not find user with username: #{username}".red
      return
    end

    if user.update password: password
      puts 'Success!'.green
    else
      puts 'Could not update user, check the errors below and try again:'.red
      user.errors.each do |attribute, message|
        puts "#{attribute} #{message}".red
      end
    end
  end

  private

  def load_environment
    ENV['RAILS_ENV'] ||= 'development'
    require File.expand_path('config/environment.rb')
  end
end
