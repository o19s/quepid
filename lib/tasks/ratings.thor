# frozen_string_literal: true

require 'colorize'
require 'csv'

class Ratings < Thor
  # rubocop:disable Metrics/MethodLength
  desc 'import CASEID FILENAME', 'imports ratings to a case'
  long_desc <<-LONGDESC
    `ratings:import` imports ratings to a case.
    The ratings should be of the following format:
    query_text, doc_id, rating

    EXAMPLES:

    $ thor ratings:import 123 import.csv

    Where import.csv is the following file:
    ```
    query_text, doc_id, rating
    ADAPTERKABEL, 6484460,  4
    ADAPTERKABEL, 6484454,  4
    万用表,        4597924,  2
    万用表,        7901262,  4
    コネクタ,      3817003,  1
    コネクタ,      4075288,  4
    ```

    -c: will clear/override existing queries and ratings.
    Default false.

    EXAMPLES:
  LONGDESC
  option :logger, type: :boolean, aliases: '-l'
  option :clear,  type: :boolean, aliases: '-c'
  def import case_id, filepath
    puts "Importing ratings for case id: #{case_id} from file: #{filepath}".yellow

    load_environment

    acase = ::Case.where(id: case_id).first

    unless acase
      puts "Could not find case with id: #{case_id}".red
      return
    end

    puts "Importing ratings for case: '#{acase.case_name}'".yellow

    begin
      ratings = ::CSV.read(filepath)

      opts    = {
        clear_existing: options[:clear],
        force:          options[:clear],
        show_progress:  true,
        drop_header:    true,
      }
      opts    = opts.merge(logger: Logger.new($stdout)) if options[:logger]
      service = ::RatingsImporter.new acase, ratings, opts

      service.import

      puts 'Success!'.green
    rescue Errno::ENOENT
      puts 'Could not find file'.red
    end
  end
  # rubocop:enable Metrics/MethodLength

  desc 'generate SOLRURL FILENAME', 'generates random ratings into a .csv file'
  long_desc <<-LONGDESC
    `ratings:generate` generates ratings that can be imported into a case.

    The script will generate random queries extracted from the Solr index, which
    can be reached at the URL passed in as a param.

    Then for each query generated, the returned results will be assigned
    ratings, which also will be randomly generated.

    EXAMPLES:

    $ thor ratings:generate http://solr.quepidapp.com import.csv

    ---------------

    -q: will override default query to use for searching.
    Default is "*:*".

    EXAMPLES:

    $ thor ratings:generate http://solr.quepidapp.com import.csv -q "text:foo"

    ---------------

    -r: will override default numbler of results to return per query.
    Default is 10.

    EXAMPLES:

    $ thor ratings:generate http://solr.quepidapp.com import.csv -r 20

    ---------------

    -s: will override default scale to use for generating ratings.
    Default is [0, 1, 2, 3].

    EXAMPLES:

    $ thor ratings:generate http://solr.quepidapp.com import.csv -s 0 1

    ---------------

    -n: will override default numbler of queries to generate.
    Default is 10.

    EXAMPLES:

    $ thor ratings:generate http://solr.quepidapp.com import.csv -n 1000

    ---------------

    -f: will override default field to extract sample queries.
    Default is "text".

    EXAMPLES:

    $ thor ratings:generate http://solr.quepidapp.com import.csv -f title

    ---------------

    -i: will override default id field.
    Default is "id".

    EXAMPLES:

    $ thor ratings:generate http://solr.quepidapp.com import.csv -i uid
  LONGDESC
  option :query,  type: :string,  aliases: '-q', default: '*:*'
  option :rows,   type: :numeric, aliases: '-r', default: 10
  option :scale,  type: :array,   aliases: '-s', default: (0..3).to_a
  option :number, type: :numeric, aliases: '-n', default: 10
  option :field,  type: :string,  aliases: '-f', default: 'text'
  option :id,     type: :string,  aliases: '-i', default: 'id'
  def generate solr_url, filepath
    puts "Generating ratings from: #{solr_url} into file: #{filepath}".yellow

    load_environment

    generator = RatingsGenerator.new solr_url, options.merge(show_progress: true)
    ratings   = generator.generate_ratings

    puts 'Success!'.green if write_ratings_to_files? ratings, filepath
  end

  private

  def load_environment
    ENV['RAILS_ENV'] ||= 'development'
    require File.expand_path('config/environment.rb')
  end

  def write_ratings_to_files? ratings, filepath
    puts 'Generating CSV file'.yellow

    begin
      CSV.open(filepath, 'wb') do |csv|
        ratings.each do |rating|
          csv << rating.values
        end
      end
    rescue Errno::ENOENT
      puts 'Could open/write to file'.red

      return false
    end

    true
  end
end
