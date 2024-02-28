# frozen_string_literal: true

require 'colorize'
require 'zip'

# rubocop:disable Metrics/ClassLength
class SampleData < Thor
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Style/VariableInterpolation
  # rubocop:enable Style/GlobalVars
  # rubocop:enable Metrics/ParameterLists

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/BlockLength
  desc 'haystack_party', 'load the haystack rating party data'
  long_desc <<-LONGDESC
  `haystack_party`

  EXAMPLES:

  $ thor haystack_party
  LONGDESC
  def haystack_party
    load_environment
    
    contents = unzip_file_in_memory(Rails.root.join('db', 'sample_data', 'haystack_rating_party_case.json.zip'))
    data = JSON.parse(contents)
    case_params = data.to_h.deep_symbolize_keys
    
    realistic_activity_user = ::User.find_by(email: 'quepid+realisticActivity@o19s.com')
    
    @case = ::Case.find_by(id: 6789)
    if @case
      @case.destroy
    end
    
    @case = ::Case.new(id: 6789)
    options = { force_create_users: true }
    case_importer = ::CaseImporter.new @case,realistic_activity_user, case_params, options
    
    case_importer.validate
    case_importer.import
    
    puts "About to import book........".yellow
    contents = unzip_file_in_memory(Rails.root.join('db', 'sample_data', 'haystack_rating_party_book.json.zip'))
    data = JSON.parse(contents)
    book_params = data.to_h.deep_symbolize_keys
    
    @book = ::Book.find_by(id: 25)
    if @book
      @book.destroy
    end
    @book = ::Book.new(id: 25)
    options = { force_create_users: true }
    book_importer = ::BookImporter.new @book,realistic_activity_user, book_params, options
    
    book_importer.validate
    book_importer.import
    
    osc = ::Team.find_by(name:"OSC")
    
    @case.book = @book
    @case.teams << osc
    @book.teams << osc
    @case.save
    @book.save    
    
    
    return

    @case.snapshots.each do |snapshot|
      puts "Delete #{snapshot.id}"
      snapshot.destroy!
    end

    snapshot_files = [ 'haystack_rating_party_snapshot_no-vector.json.zip',
                       'haystack_rating_party_snapshot_vector-2.json.zip',
                       'haystack_rating_party_snapshot_with-vector.json.zip' ]

    snapshot_files.each do |snapshot_file|
      puts "Processing #{snapshot_file}".yellow
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
  # rubocop:enable Metrics/AbcSize
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
end
# rubocop:enable Metrics/ClassLength
