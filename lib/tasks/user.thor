# frozen_string_literal: true

require 'colorize'

class User < Thor
  # rubocop:disable Metrics/MethodLength
  desc 'create EMAIL USERNAME PASSWORD', 'creates a new user'
  long_desc <<-LONGDESC
    `user:create` creates a new user with the passed in email, name and password.

    EXAMPLES:

    $ thor user:create foo@example.com "Eric Pugh" mysuperstrongpassword

    With -a option, will mark the user as Administrator

    EXAMPLES:

    $ thor user:create -a admin@example.com Administrator mysuperstrongpassword
  LONGDESC
  option :administrator, type: :boolean, aliases: '-a'
  def create email, name, password
    is_administrator = options[:administrator] || false
    puts "Creating a new user with email: #{email}, name: #{name}, password: #{password}.".yellow
    puts "Marking user as administrator? #{is_administrator}".yellow

    load_environment

    user_params = {
      email:         email, # Quepid Issue #111 will fix this.
      name:          name,
      password:      password,
      administrator: is_administrator,
      agreed_time:   Time.zone.now,
      agreed:        true,
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

  desc 'reset_password EMAIL NEWPASSWORD', "resets user's password"
  long_desc <<-LONGDESC
    `user:reset_password` resets the user's password to the new password
    passed in.

    EXAMPLES:

    $ thor user:reset_password foo@example.com newpass
  LONGDESC
  def reset_password email, password
    puts "Resetting password for user with email: #{email}".yellow

    load_environment

    user = ::User.where(email: email).first

    unless user
      puts "Could not find user with email: #{email}".red
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

  desc 'grant_administrator EMAIL', 'grant administrator privileges to user'
  long_desc <<-LONGDESC
    `user:grant_administrator` grants the user the administrator privileges.

    EXAMPLES:

    $ thor user:grant_administrator foo@example.com
  LONGDESC
  def grant_administrator email
    puts "Granting administrator privileges to user with email: #{email}".yellow

    load_environment

    user = ::User.where(email: email).first

    unless user
      puts "Could not find user with email: #{email}".red
      return
    end

    if user.update administrator: true
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
