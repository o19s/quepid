# frozen_string_literal: true

require 'colorize'
require 'zip'

class Case < Thor
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Style/VariableInterpolation
  # rubocop:disable Style/GlobalVars
  # rubocop:disable Metrics/ParameterLists
  desc 'create NAME SEARCH_ENGINE ENDPOINT_URL API_METHOD FIELD_SPEC QUERY_PARAMS SCORER_NAME OWNER_EMAIL',
       'creates a new case'
  long_desc <<-LONGDESC
    `case:create` creates a new case with the passed in name, search url, field specification, query_params, scorer and owner.

    EXAMPLES:

    $ thor user:create "Movies Search" solr http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select JSONP "id:id, title:title, overview, cast, thumb:poster_path" "q=#$query##&defType=edismax&qf=text_all&tie=1.0" nDCG@10 foo@example.com

  LONGDESC
  def create name, search_engine, endpoint_url, api_method, field_spec, query_params, scorer_name, owner_email
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
      case_name:       name,
      owner:           owner,
      scorer:          scorer,
      last_try_number: 1,
    }

    try_params = {
      field_spec:   field_spec,
      query_params: query_params,
    }

    search_endpoint_params = {
      search_engine: search_engine,
      endpoint_url:  endpoint_url,
      api_method:    api_method,
    }

    acase = ::Case.new(case_params)

    convert_blank_values_to_nil search_endpoint_params

    search_endpoint = owner.search_endpoints_involved_with.find_by search_endpoint_params
    if search_endpoint.nil?
      search_endpoint = SearchEndpoint.new search_endpoint_params
      search_endpoint.owner = owner
      search_endpoint.save!
    end

    try_params[:search_endpoint_id] = search_endpoint.id

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
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/BlockLength
  desc 'load_the_haystack_rating_snapshots', 'load the haystack rating party data'
  long_desc <<-LONGDESC
  `load_the_haystack_rating_snapshots`

  EXAMPLES:

  $ thor load_the_haystack_rating_snapshots
  LONGDESC
  def load_the_haystack_rating_snapshots
    load_environment

    @case = ::Case.find(6789)
    @case.snapshots.each do |snapshot|
      puts "Delete #{snapshot.id}"
      snapshot.destroy!
    end

    snapshot_files = [ 'haystack_rating_party_snapshot_no-vector.json.zip',
                       'haystack_rating_party_snapshot_vector-2.json.zip',
                       'haystack_rating_party_snapshot_with-vector.json.zip' ]

    snapshot_files.each do |snapshot_file|
      puts "Processing #{snapshot_file}"
      contents = unzip_file_in_memory(Rails.root.join('db', 'sample_data/', snapshot_file))
      data = JSON.parse(contents)
      snapshot_params = data.to_h.deep_symbolize_keys
      # map the sample data's query.id to the now created local query.id's
      sample_data_query_id_mapping = {}

      params = {
        id:         snapshot_params[:id],
        name:       snapshot_params[:name],
        created_at: snapshot_params[:created_at],
      }

      snapshot = @case.snapshots.create params

      snapshot_params[:queries].each do |q|
        query = @case.queries.find_by(query_text: q[:query_text] )
        sample_data_query_id_mapping[q[:query_id].to_s.to_sym] = query.id

        snapshot_query = snapshot.snapshot_queries.create({
          all_rated:         true,
          number_of_results: 1,
          score:             1,
          query:             query,
        })

        q[:ratings].each_with_index do |(key, value), index|
          query.ratings.create({
            doc_id: key,
            rating: value,
          })

          snapshot_query.snapshot_docs.create({
            explain:    nil,
            fields:     nil,
            position:   index + 1,
            doc_id:     key,
            rated_only: false,
          })
        end
      end
    end
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/BlockLength

  private

  def unzip_file_in_memory zip_file
    Zip::File.open(zip_file) do |zip|
      entry = zip.first
      entry.get_input_stream.read
    end
  end

  def load_environment
    ENV['RAILS_ENV'] ||= 'development'
    require File.expand_path('config/environment.rb')
  end

  def convert_blank_values_to_nil hash
    hash.each do |key, value|
      if value.is_a?(Hash)
        convert_blank_values_to_nil(value) # Recursively call the method for nested hashes
      elsif value.blank?
        hash[key] = nil
      end
    end
  end
end
