# frozen_string_literal: true

require 'colorize'

# rubocop:disable Metrics/ClassLength
class Snapshots < Thor
  # rubocop:disable Metrics/MethodLength
  desc 'import CASEID SNAPSHOTNAME FILENAME', 'imports a snapshot to a case'
  long_desc <<-LONGDESC
    `snapshots:import` imports a snapshot to a case.
    The snapshot should be of the following format:
    Query Text,Doc ID,Doc Position

    EXAMPLES:

    $ thor ratings:import 123 "Imported Snapshot" import.csv

    Where import.csv is the following file:
    ```
    feline,l_2393,1
    canine,l_2486,1
    canine,l_2484,2
    canine,l_2485,3
    canine,l_2487,4
    ```
  LONGDESC
  option :logger, type: :boolean, aliases: '-l'
  def import case_id, snapshot_name, filepath
    puts "Importing snapshot: '#{snapshot_name}' for case id: #{case_id} from file: #{filepath}".yellow

    load_environment

    acase = ::Case.where(id: case_id).first

    unless acase
      puts "Could not find case with id: #{case_id}".red
      return
    end

    puts "Importing snapshot for case: '#{acase.caseName}'".yellow

    begin
      data    = ::CSV.read(filepath)
      opts    = { show_progress: true }
      opts    = opts.merge(logger: Logger.new($stdout)) if options[:logger]

      snapshot_params = {
        case_id: acase.id,
        name:    snapshot_name,
      }

      snapshot  = ::Snapshot.create snapshot_params
      service   = ::SnapshotManager.new snapshot, opts

      queries = service.csv_to_queries_hash data
      service.import_queries queries

      puts 'Success!'.green
    rescue Errno::ENOENT
      puts 'Could not find file'.red
    end
  end

  desc 'generate SOLRURL FILENAME', 'generates a random snapshot into a .csv file'
  long_desc <<-LONGDESC
    `snapshots:generate` generates a snapshot that can be imported into a case.

    The script will generate random queries extracted from the Solr index,
    which can be reached at the URL passed in as a param.

    Then for each query generated, the returned results will be assigned
    a position.

    EXAMPLES:

    $ thor snapshots:generate http://solr.quepidapp.com import.csv

    ---------------

    -q: will override default query to use for searching.
    Default is "*:*".

    EXAMPLES:

    $ thor snapshots:generate http://solr.quepidapp.com import.csv -q "text:foo"

    ---------------

    -r: will override default numbler of results to return per query.
    Default is 10.

    EXAMPLES:

    $ thor snapshots:generate http://solr.quepidapp.com import.csv -r 20

    ---------------

    -s: will override default scale to use for generating snapshots.
    Default is [0, 1, 2, 3].

    EXAMPLES:

    $ thor snapshots:generate http://solr.quepidapp.com import.csv -s 0 1

    ---------------

    -n: will override default numbler of queries to generate.
    Default is 10.

    EXAMPLES:

    $ thor snapshots:generate http://solr.quepidapp.com import.csv -n 1000

    ---------------

    -f: will override default field to extract sample queries.
    Default is "text".

    EXAMPLES:

    $ thor snapshots:generate http://solr.quepidapp.com import.csv -f title

    ---------------

    -i: will override default id field.
    Default is "id".

    EXAMPLES:

    $ thor snapshots:generate http://solr.quepidapp.com import.csv -i uid
  LONGDESC
  option :query,  type: :string,  aliases: '-q', default: '*:*'
  option :rows,   type: :numeric, aliases: '-r', default: 10
  option :scale,  type: :array,   aliases: '-s', default: (0..3).to_a
  option :number, type: :numeric, aliases: '-n', default: 10
  option :field,  type: :string,  aliases: '-f', default: 'text'
  option :id,     type: :string,  aliases: '-i', default: 'id'
  def generate solr_url, filepath
    puts "Generating snapshot from: #{solr_url} into file: #{filepath}".yellow

    load_environment
    opts      = options.merge(show_progress: true)
    generator = SnapshotGenerator.new solr_url, opts
    data      = generator.generate_snapshot

    puts 'Success!'.green if write_to_file? data, filepath
  end

  private

  def load_environment
    ENV['RAILS_ENV'] ||= 'development'
    require File.expand_path('config/environment.rb')
  end

  def write_to_file? data, filepath
    puts 'Generating CSV file'.yellow

    begin
      CSV.open(filepath, 'wb') do |csv|
        data.each do |datum|
          csv << datum.values
        end
      end
    rescue Errno::ENOENT
      puts 'Could open/write to file'.red

      return false
    end

    true
  end
  # rubocop:enable Metrics/MethodLength
end
# rubocop:enable Metrics/ClassLength
