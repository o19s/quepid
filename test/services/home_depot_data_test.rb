# frozen_string_literal: true

require 'test_helper'

class HomeDepotDataTest < ActiveSupport::TestCase
  setup do
    @directory = Pathname.new(Dir.mktmpdir('home_depot'))
    HomeDepotData.directory = @directory
    @uploads = Dir.mktmpdir('uploads')
  end

  teardown do
    HomeDepotData.directory = nil
    FileUtils.rm_rf(@directory)
    FileUtils.rm_rf(@uploads)
  end

  def zip_of entries
    path = File.join(@uploads, 'upload.zip')
    Zip::OutputStream.open(path) do |zip|
      entries.each do |file, content|
        zip.put_next_entry(file)
        zip.write(content)
      end
    end
    path
  end

  test 'keeps the three files from the zip Kaggle gives, each zipped once more inside it' do
    assert_not HomeDepotData.uploaded?

    HomeDepotData.store!(home_depot_zip)

    assert_predicate HomeDepotData, :uploaded?
    HOME_DEPOT_FILES.each { |file, content| assert_equal content, File.binread(@directory.join(file)) }
    assert_empty Dir.children(@directory).grep(/\.part\z/)
  end

  test 'takes a zip of the plain files too, in a folder' do
    HomeDepotData.store!(zip_of(HOME_DEPOT_FILES.transform_keys { |file| "home-depot/#{file}" }.merge('__MACOSX/home-depot/._train.csv' => 'x')))

    assert_predicate HomeDepotData, :uploaded?
  end

  test 'refuses a zip without one of the files, and keeps nothing of it' do
    error = assert_raises(HomeDepotData::Error) { HomeDepotData.store!(home_depot_zip(HOME_DEPOT_FILES.except('attributes.csv'))) }

    assert_match(/The zip has no attributes\.csv/, error.message)
    assert_not HomeDepotData.uploaded?
    assert_empty Dir.children(@directory).grep(/\.(csv|part)\z/)
  end

  test 'refuses a file without the columns the competition has, and keeps what was uploaded before' do
    HomeDepotData.store!(home_depot_zip)

    error = assert_raises(HomeDepotData::Error) { HomeDepotData.store!(home_depot_zip(HOME_DEPOT_FILES.merge('train.csv' => "a,b\n1,2\n"))) }

    assert_match(/train\.csv does not start with the columns/, error.message)
    assert_equal HOME_DEPOT_FILES['train.csv'], File.binread(@directory.join('train.csv'))
  end

  test 'reads the rows as UTF-8, from the ISO-8859-1 the competition wrote' do
    HomeDepotData.store!(home_depot_zip)
    titles = []
    HomeDepotData.each_row(:train) { |row| titles << row['product_title'] }

    assert_includes titles, 'Delta 90° Shower Faucet'
    assert(titles.all? { |title| Encoding::UTF_8 == title.encoding && title.valid_encoding? })
  end

  test 'counts the distinct search terms uploaded, and none before an upload' do
    assert_nil HomeDepotData.query_total

    HomeDepotData.store!(home_depot_zip)

    assert_equal 4, HomeDepotData.query_total, 'angle bracket, l bracket, shower faucet, deck over; the blank one is not a term'
  end

  test 'deletes the files once they have been imported, and then says to upload them again' do
    HomeDepotData.store!(home_depot_zip)

    HomeDepotData.discard!

    assert_not HomeDepotData.uploaded?
    assert_empty Dir.children(@directory).grep(/\.csv\z/)
    error = assert_raises(HomeDepotData::Error) { HomeDepotData.each_row(:train) { |_| nil } }
    assert_match(/upload them again/, error.message)
  end

  test 'refuses a file that is not a zip' do
    path = File.join(@uploads, 'train.csv')
    File.binwrite(path, HOME_DEPOT_FILES['train.csv'])

    error = assert_raises(HomeDepotData::Error) { HomeDepotData.store!(path) }

    assert_match(/could not read that file as a zip/, error.message)
  end
end
