# frozen_string_literal: true

require 'colorize'

class Case < Thor
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Style/VariableInterpolation
  # rubocop:disable Style/GlobalVars
  # rubocop:disable Metrics/ParameterLists
  desc 'create NAME SEARCH_ENGINE SEARCH_URL API_METHOD FIELD_SPEC QUERY_PARAMS SCORER_NAME OWNER_EMAIL',
       'creates a new case'
  long_desc <<-LONGDESC
    `case:create` creates a new case with the passed in name, search url, field specification, query_params, scorer and owner.

    EXAMPLES:

    $ thor user:create "Movies Search" solr http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select JSONP "id:id, title:title, overview, cast, thumb:poster_path" "q=#$query##&defType=edismax&qf=text_all&tie=1.0" nDCG@10 foo@example.com

  LONGDESC
  def create name, search_engine, search_url, api_method, field_spec, query_params, scorer_name, owner_email
    load_environment
    
    scorer = Scorer.find_by! name: scorer_name
    unless scorer
      puts "Could not find scorer with name: #{scorer_name}".red
      return
    end
    owner = ::User.find_by! email: owner_email
    unless owner
      puts "Could not find owner with email: #{owner_email}".red
      return
    end

    puts "Creating a new case for the user #{owner.name} with the scorer #{scorer.name}".yellow

    case_params = {
      case_name: name,
      owner:     owner,
      scorer:    scorer,
    }

    try_params = {
      search_engine: search_engine,
      search_url:    search_url,
      api_method:    api_method,
      field_spec:    field_spec,
      query_params:  query_params,
    }

    acase = ::Case.new(case_params)
    acase.tries << Try.new(try_params)

    if acase.save
      puts 'Success!'.green
    else
      puts 'Could not create case, check the errors below and try again:'.red
      acase.errors.each do |attribute, message|
        puts "#{attribute} #{message}".red
      end
    end
  end

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
  # rubocop:enable Style/VariableInterpolation
  # rubocop:enable Style/GlobalVars
  # rubocop:enable Metrics/ParameterLists

  private

  def load_environment
    ENV['RAILS_ENV'] ||= 'development'
    require File.expand_path('config/environment.rb')
  end
end
