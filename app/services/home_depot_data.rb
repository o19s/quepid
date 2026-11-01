# frozen_string_literal: true

require 'csv'
require 'fileutils'
require 'zip'

# The Home Depot Product Search Relevance competition data (Kaggle). Kaggle only gives the files to someone signed in who
# has accepted the competition's rules, so Quepid cannot download them the way it does WANDS': a user uploads the zip that
# Download All on the competition's Data tab gives. The three files Quepid uses are taken out of it and kept in tmp/ only
# until they are imported into a case: the import calls discard! when it is done. That zip holds each file zipped once
# more (train.csv.zip); a zip of the plain files is taken too.
module HomeDepotData
  class Error < StandardError; end

  COMPETITION_URL = 'https://www.kaggle.com/competitions/home-depot-product-search-relevance'

  # name => the file, and the columns it must start with (so a changed or broken file is noticed, not read wrongly).
  FILES = {
    train:        [ 'train.csv', %w[id product_uid product_title search_term relevance] ],
    descriptions: [ 'product_descriptions.csv', %w[product_uid product_description] ],
    attributes:   [ 'attributes.csv', %w[product_uid name value] ],
  }.freeze

  # The biggest file, unzipped, is a few hundred MB: anything far beyond that is not the competition's.
  MAX_BYTES = 1024 * 1024 * 1024

  class << self
    attr_writer :directory

    def directory
      @directory ||= Rails.root.join('tmp/datasets/home_depot')
    end

    def path name
      directory.join(FILES.fetch(name).first)
    end

    def uploaded?
      FILES.each_key.all? { |name| File.size?(path(name)).present? }
    end

    # Deletes the uploaded files, once they have been imported: Quepid does not keep the competition's data.
    def discard!
      FILES.each_key { |name| FileUtils.rm_f(path(name)) }
    end

    # Yields each row of an uploaded file as a hash (header => value). The files are ISO-8859-1.
    def each_row name, &block
      raise Error, 'The Home Depot files are not uploaded (or were imported already): upload them again on the Datasets tab.' unless uploaded?

      CSV.foreach(path(name), headers: true, encoding: 'ISO-8859-1:UTF-8', liberal_parsing: true) { |row| block.call(row.to_h) }
    end

    # How many distinct search terms the uploaded train.csv has, or nil when nothing is uploaded. Counted once per upload.
    def query_total
      return unless uploaded?

      stamp = File.mtime(path(:train))
      @query_total = nil unless @query_total_stamp == stamp
      @query_total_stamp = stamp
      @query_total ||= begin
        terms = Set.new
        each_row(:train) { |row| terms << row['search_term'].to_s.strip }
        terms.delete('')
        terms.size
      end
    end

    # Takes the files out of an uploaded zip and keeps them. Each is checked before any is kept, and they are written
    # under other names and moved into place when all are whole, so a bad upload leaves what was there before.
    def store! zip_path
      FileUtils.mkdir_p(directory)
      parts = {}
      File.open(directory.join('.lock'), File::RDWR | File::CREAT) do |lock|
        lock.flock(File::LOCK_EX)
        Zip::File.open(zip_path.to_s) do |zip|
          FILES.each do |name, (file, columns)|
            parts[name] = directory.join("#{file}.#{Process.pid}.part")
            extract(zip, file, parts[name])
            check_columns(parts[name], columns, file)
          end
        end
        parts.each { |name, part| File.rename(part, path(name)) }
      end
    rescue Zip::Error => e
      raise Error, "Quepid could not read that file as a zip: #{e.message}"
    ensure
      parts&.each_value { |part| FileUtils.rm_f(part) }
    end

    private

    # The file, plain or zipped once more, wherever it is in the zip.
    def extract zip, file, destination
      entry = find(zip, file)
      return copy(entry.get_input_stream, destination, file) if entry

      nested = find(zip, "#{file}.zip") or raise Error, "The zip has no #{file}: upload the zip that Download All on the " \
                                                        "competition's Data tab gives."
      Tempfile.create([ 'home_depot', '.zip' ]) do |inner|
        inner.binmode
        copy(nested.get_input_stream, inner.path, "#{file}.zip")
        Zip::File.open(inner.path) do |inner_zip|
          entry = find(inner_zip, file) or raise Error, "#{file}.zip has no #{file} in it."
          copy(entry.get_input_stream, destination, file)
        end
      end
    end

    # Zips made on a Mac also carry a __MACOSX/ resource-fork entry.
    def find zip, file
      zip.find { |entry| entry.file? && !entry.name.start_with?('__MACOSX') && File.basename(entry.name) == file }
    end

    def copy input, destination, file
      written = 0
      File.open(destination, 'wb') do |output|
        while (chunk = input.read(1024 * 1024))
          written += chunk.bytesize
          raise Error, "#{file} is larger than #{MAX_BYTES / 1024 / 1024} MB, so it is not the competition's file." if written > MAX_BYTES

          output.write(chunk)
        end
      end
    end

    # The files are ISO-8859-1, so the header line is read as that.
    def check_columns path, columns, file
      first_line = File.open(path, 'rb') { |io| io.gets.to_s }.delete_prefix("\xEF\xBB\xBF".b)
      found = CSV.parse_line(first_line.force_encoding('ISO-8859-1').encode('UTF-8')) || []
      raise Error, "#{file} does not start with the columns the competition's #{file} has, so it was not kept." unless found.map(&:strip) == columns
    rescue CSV::MalformedCSVError
      raise Error, "#{file} does not start with the columns the competition's #{file} has, so it was not kept."
    end
  end
end
