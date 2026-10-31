# frozen_string_literal: true

require 'test_helper'

class HomeDepotDataTest < ActiveSupport::TestCase
  FILES = {
    'train.csv'                => "\"id\",\"product_uid\",\"product_title\",\"search_term\",\"relevance\"\n2,100001,\"Simpson Strong-Tie 12-Gauge Angle\",\"angle bracket\",3\n",
    'product_descriptions.csv' => "\"product_uid\",\"product_description\"\n100001,\"Not only do angles make joints stronger\"\n",
    'attributes.csv'           => "\"product_uid\",\"name\",\"value\"\n100001,\"MFG Brand Name\",\"Simpson Strong-Tie\"\n",
  }.freeze

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

  def zip_of entries, name: 'upload.zip'
    path = File.join(@uploads, name)
    Zip::OutputStream.open(path) do |zip|
      entries.each do |file, content|
        zip.put_next_entry(file)
        zip.write(content)
      end
    end
    path
  end

  # As Kaggle's Download All gives it: each file zipped once more, inside one zip.
  def kaggle_zip files = FILES
    zip_of(files.to_h { |file, content| [ "#{file}.zip", File.binread(zip_of({ file => content }, name: "#{file}.zip")) ] }
      .merge('sample_submission.csv.zip' => File.binread(zip_of({ 'sample_submission.csv' => "id,relevance\n" }, name: 'sample.zip'))))
  end

  test 'keeps the three files from the zip Kaggle gives, each zipped once more inside it' do
    assert_not HomeDepotData.uploaded?

    HomeDepotData.store!(kaggle_zip)

    assert_predicate HomeDepotData, :uploaded?
    FILES.each { |file, content| assert_equal content, File.read(@directory.join(file)) }
    assert_empty Dir.children(@directory).grep(/\.part\z/)
  end

  test 'takes a zip of the plain files too, in a folder' do
    HomeDepotData.store!(zip_of(FILES.transform_keys { |file| "home-depot/#{file}" }.merge('__MACOSX/home-depot/._train.csv' => 'x')))

    assert_predicate HomeDepotData, :uploaded?
  end

  test 'refuses a zip without one of the files, and keeps nothing of it' do
    error = assert_raises(HomeDepotData::Error) { HomeDepotData.store!(kaggle_zip(FILES.except('attributes.csv'))) }

    assert_match(/The zip has no attributes\.csv/, error.message)
    assert_not HomeDepotData.uploaded?
    assert_empty Dir.children(@directory).grep(/\.(csv|part)\z/)
  end

  test 'refuses a file without the columns the competition has, and keeps what was uploaded before' do
    HomeDepotData.store!(kaggle_zip)

    error = assert_raises(HomeDepotData::Error) { HomeDepotData.store!(kaggle_zip(FILES.merge('train.csv' => "a,b\n1,2\n"))) }

    assert_match(/train\.csv does not start with the columns/, error.message)
    assert_equal FILES['train.csv'], File.read(@directory.join('train.csv'))
  end

  test 'deletes the files once they have been imported' do
    HomeDepotData.store!(kaggle_zip)

    HomeDepotData.discard!

    assert_not HomeDepotData.uploaded?
    assert_empty Dir.children(@directory).grep(/\.csv\z/)
  end

  test 'refuses a file that is not a zip' do
    path = File.join(@uploads, 'train.csv')
    File.write(path, FILES['train.csv'])

    error = assert_raises(HomeDepotData::Error) { HomeDepotData.store!(path) }

    assert_match(/could not read that file as a zip/, error.message)
  end
end
