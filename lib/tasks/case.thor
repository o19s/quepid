# frozen_string_literal: true

require 'colorize'

class Case < Thor
  # rubocop:disable Metrics/MethodLength
  desc 'share CASEID TEAMID', 'shares case with an team'
  long_desc <<-LONGDESC
    `case:share` share the case with an team.

    EXAMPLES:

    $ thor case:share 123 456
  LONGDESC
  def share case_id, team_id
    puts "Sharing case id: #{case_id} with team id: #{team_id}".yellow

    load_environment

    acase = ::Case.where(id: case_id).first

    unless acase
      puts "Could not find case with id: #{case_id}".red
      return
    end

    team = ::Team.where(id: team_id).first

    unless team
      puts "Could not find team with id: #{team_id}".red
      return
    end

    puts "Sharing case: '#{acase.caseName}' with team: '#{team.name}'".yellow

    acase.teams << team unless acase.teams.include? team
    if acase.save
      puts 'Success!'.green
    else
      puts 'Could not update case, check the errors below and try again:'.red
      acase.errors.each do |attribute, message|
        puts "#{attribute} #{message}".red
      end
    end
  end
  # rubocop:enable Metrics/MethodLength

  private

  def load_environment
    ENV['RAILS_ENV'] ||= 'development'
    require File.expand_path('config/environment.rb')
  end
end
