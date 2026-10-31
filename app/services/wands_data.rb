# frozen_string_literal: true

require 'csv'
require 'fileutils'
require 'net/http'

# Wayfair's WANDS dataset (https://github.com/wayfair/WANDS, MIT licence): 480 queries, 42,994 products and 233,448
# labels saying how well a product answers a query. It is not kept in Quepid: the three files are downloaded from
# GitHub the first time they are needed, and stay in tmp/ after that. The labels and queries are small (6 MB); the
# product file is 90 MB, and is only fetched when the documents are indexed.
module WandsData
  class Error < StandardError; end

  BASE_URL = 'https://raw.githubusercontent.com/wayfair/WANDS/main/dataset'

  # name => the file, and the header line it must start with (so a changed or broken file is noticed, not read wrongly).
  FILES = {
    query:   [ 'query.csv', "query_id\tquery\tquery_class" ],
    product: [ 'product.csv', "product_id\tproduct_name\tproduct_class\tcategory hierarchy\tproduct_description\tproduct_features\trating_count\taverage_rating\treview_count" ],
    label:   [ 'label.csv', "id\tquery_id\tproduct_id\tlabel" ],
  }.freeze

  # The biggest file is 90 MB: anything far beyond that is not what was asked for.
  MAX_BYTES = 200 * 1024 * 1024

  class << self
    attr_writer :directory

    def directory
      @directory ||= Rails.root.join('tmp/datasets/wands')
    end

    def path name
      directory.join(FILES.fetch(name).first)
    end

    def cached? name
      File.size?(path(name)).present?
    end

    # Makes sure the named files are on disk, downloading the ones that are not.
    def fetch! *names
      names.each { |name| download(name) unless cached?(name) }
    end

    # Yields each row of a file as a hash (header => value), downloading the file first if need be.
    def each_row name, &block
      fetch!(name)
      # A few fields are quoted, with their own quotes doubled (query 208 is "fawkes 36"" blue vanity"); liberal parsing
      # keeps a quote inside an unquoted field (a 5" nail) as it is.
      CSV.foreach(path(name), headers: true, col_sep: "\t", liberal_parsing: true, encoding: 'UTF-8') { |row| block.call(row.to_h) }
    end

    private

    # One process downloads a file at a time; one that waited finds it there. The file is written under another name and
    # moved into place when whole, so a failed download never leaves half a file that looks like the real one.
    def download name
      file, header = FILES.fetch(name)
      FileUtils.mkdir_p(directory)
      File.open(directory.join('.lock'), File::RDWR | File::CREAT) do |lock|
        lock.flock(File::LOCK_EX)
        next if cached?(name)

        part = directory.join("#{file}.#{Process.pid}.part")
        begin
          stream("#{BASE_URL}/#{file}", part)
          check_header(part, header, file)
          File.rename(part, path(name))
        ensure
          FileUtils.rm_f(part)
        end
      end
    end

    def stream url, destination
      uri = URI(url)
      Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 15, read_timeout: 60) do |http|
        http.request(Net::HTTP::Get.new(uri)) do |response|
          raise Error, "GitHub answered #{response.code} for #{url}" unless response.is_a?(Net::HTTPSuccess)

          write_body(response, destination)
        end
      end
    rescue SocketError, Timeout::Error, SystemCallError, OpenSSL::SSL::SSLError, Net::ProtocolError => e
      raise Error, "Could not download #{url}: #{e.message}"
    end

    def write_body response, destination
      written = 0
      File.open(destination, 'wb') do |file|
        response.read_body do |chunk|
          written += chunk.bytesize
          raise Error, "#{destination.basename} is larger than #{MAX_BYTES / 1024 / 1024} MB, so it is not the WANDS file" if written > MAX_BYTES

          file.write(chunk)
        end
      end
    end

    def check_header path, header, file
      first_line = File.open(path, 'rb') { |io| io.gets.to_s }.delete_prefix("\xEF\xBB\xBF").chomp
      raise Error, "#{file} does not start with the columns WANDS' #{file} has, so it was not read" unless first_line == header
    end
  end
end
