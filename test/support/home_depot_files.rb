# frozen_string_literal: true

require 'zip'

module ActiveSupport
  class TestCase
    # A small Home Depot competition upload, in the competition's own shape: ISO-8859-1 (100003's title has a degree sign,
    # byte B0), scores that are averages of raters, a pair rated twice (shower faucet / 100003), a blank search term, and a
    # described product nobody rated (100099). What the import makes of it:
    #   angle bracket  100001 3    -> 2   100002 1.33 -> 0
    #   l bracket      100001 2.5  -> 2
    #   shower faucet  100003 1.5 and 2.5, so 2 -> 1
    #   deck over      100002 2.33 -> 1
    HOME_DEPOT_FILES = {
      'train.csv'                => "\"id\",\"product_uid\",\"product_title\",\"search_term\",\"relevance\"\n" \
                                    "2,100001,\"Simpson Strong-Tie 12-Gauge Angle\",\"angle bracket\",3\n" \
                                    "3,100001,\"Simpson Strong-Tie 12-Gauge Angle\",\"l bracket\",2.5\n" \
                                    "4,100002,\"BEHR Premium Textured DeckOver 1-gal.\",\"angle bracket\",1.33\n" \
                                    "5,100003,\"Delta 90\xB0 Shower Faucet\",\"shower faucet\",1.5\n" \
                                    "6,100003,\"Delta 90\xB0 Shower Faucet\",\"shower faucet\",2.5\n" \
                                    "7,100002,\"BEHR Premium Textured DeckOver 1-gal.\",\"deck over\",2.33\n" \
                                    "8,100004,\"Something\",\"  \",3\n".b,
      'product_descriptions.csv' => "\"product_uid\",\"product_description\"\n" \
                                    "100001,\"Not only do angles make joints stronger\"\n" \
                                    "100002,\"Revives wood and composite decks\"\n" \
                                    "100003,\"A single-handle shower faucet\"\n" \
                                    "100099,\"Nobody rated this one\"\n".b,
      'attributes.csv'           => "\"product_uid\",\"name\",\"value\"\n" \
                                    "100001,\"Bullet01\",\"Versatile connector\"\n" \
                                    "100001,\"MFG Brand Name\",\"Simpson Strong-Tie\"\n" \
                                    "100002,\"MFG Brand Name\",\"BEHR Premium Textured DeckOver\"\n" \
                                    "100099,\"MFG Brand Name\",\"Nobody\"\n".b,
    }.freeze

    # A zip as Download All on the competition's Data tab gives it: each file zipped once more, inside one zip, with the
    # sample submission too. Returns its path; it is deleted after the test.
    def home_depot_zip files = HOME_DEPOT_FILES
      directory = Dir.mktmpdir('home_depot_zip')
      (@home_depot_zip_directories ||= []) << directory
      inner = files.to_h do |file, content|
        [ "#{file}.zip", Zip::OutputStream.write_buffer { |zip| zip.put_next_entry(file) && zip.write(content) }.string ]
      end
      inner['sample_submission.csv.zip'] = Zip::OutputStream.write_buffer { |zip| zip.put_next_entry('sample_submission.csv') && zip.write("id,relevance\n") }.string
      path = File.join(directory, 'home-depot-product-search-relevance.zip')
      Zip::OutputStream.open(path) { |zip| inner.each { |name, bytes| zip.put_next_entry(name) && zip.write(bytes) } }
      path
    end

    # Points HomeDepotData at an empty folder of the test's own for the block, and stores an upload there if given one.
    def with_home_depot_upload zip = nil
      directory = Pathname.new(Dir.mktmpdir('home_depot'))
      HomeDepotData.directory = directory
      HomeDepotData.store!(zip) if zip
      yield directory
    ensure
      HomeDepotData.directory = nil
      FileUtils.rm_rf(directory) if directory
    end

    teardown do
      @home_depot_zip_directories&.each { |directory| FileUtils.rm_rf(directory) }
    end
  end
end
