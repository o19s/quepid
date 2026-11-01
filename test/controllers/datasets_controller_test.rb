# frozen_string_literal: true

require 'test_helper'

class DatasetsControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }

  # Home Depot's uploaded files are looked for in a folder of the test's own, empty unless a test uploads.
  setup do
    login_user_for_integration_test user
    @home_depot_directory = Pathname.new(Dir.mktmpdir('home_depot'))
    HomeDepotData.directory = @home_depot_directory
  end

  teardown do
    HomeDepotData.directory = nil
    FileUtils.rm_rf(@home_depot_directory)
  end

  test 'index lists the loadable datasets first, then the coming soon ones' do
    get datasets_url

    assert_response :success
    names = css_select('tbody tr td:first-child a').map(&:text)

    assert_equal [ 'Haystack Rating Party', 'WANDS', 'Home Depot Product Search Relevance' ], names.first(3)
    assert_equal [ 'ESCI', 'IMDb Non-Commercial Datasets' ], names.last(2)
    assert_select 'button[disabled]', text: 'Coming soon', count: 2
  end

  test 'index describes each dataset by its queries, documents, judgements and labels, and nothing else' do
    get datasets_url

    %w[Queries Documents Judgements Labels Licence Cases].each { |heading| assert_select 'th', text: heading }
    assert_select 'th', text: /\AScorers/
    assert_select 'th', text: 'In Quepid', count: 0
    assert_select 'td', text: '137 queries'
    assert_select 'td', text: '0 Poor, 1 Fair, 2 Good, 3 Perfect'
  end

  test 'index has the two tabs and one load to case button per loadable dataset' do
    Scorer.create!(name: 'Haystack Rating Party Mine', owner: user, scale: [ 0, 1, 2, 3 ])
    get datasets_url

    assert_select 'ul.nav-tabs a.nav-link.active', text: 'Datasets'
    assert_select 'ul.nav-tabs a[href=?]', dataset_cases_path, text: 'Dataset Cases'
    assert_select 'a[href=?]', dataset_cases_path(dataset: 'haystack'), text: 'Load to case', count: 1
    assert_select 'a[href=?]', dataset_cases_path(dataset: 'imdb'), count: 0, message: 'IMDb is coming soon'
    assert_select 'a, button', text: /Index in search backend/, count: 0
  end

  test 'index counts the cases made from each dataset, without archived ones' do
    get datasets_url

    assert_equal(%w[0 0 0 — —], css_select('tbody tr td:nth-child(9)').map { |cell| cell.text.strip })

    dataset = Dataset.for(user, 'haystack')
    [ Case.create!(case_name: 'One', owner: user), Case.create!(case_name: 'Two', owner: user),
      Case.create!(case_name: 'Archived', owner: user, archived: true) ].each do |kase|
      CaseToDataset.create!(dataset: dataset, case: kase)
    end
    get datasets_url

    assert_equal(%w[2 0 0 — —], css_select('tbody tr td:nth-child(9)').map { |cell| cell.text.strip })
  end

  test 'index counts only the current users cases' do
    CaseToDataset.create!(dataset: Dataset.for(users(:doug), 'haystack'), case: Case.create!(case_name: 'Theirs', owner: users(:doug)))
    get datasets_url

    assert_equal(%w[0 0 0 — —], css_select('tbody tr td:nth-child(9)').map { |cell| cell.text.strip })
  end

  test 'index disables load to case for a dataset with labels until it has a scorer' do
    get datasets_url

    assert_select 'button[disabled]', text: 'Load to case', count: 3, message: 'Haystack and WANDS have no scorer yet, Home Depot no upload'
    assert_select 'span[title*=?]', 'Create a scorer first', count: 2
    assert_select 'span[title*=?]', 'Upload the data first', count: 1
    assert_select 'a[href=?]', dataset_cases_path(dataset: 'haystack'), count: 0
    assert_select 'a[href=?]', dataset_cases_path(dataset: 'wands'), count: 0

    Scorer.create!(name: 'Haystack Rating Party Mine', owner: user, scale: [ 0, 1, 2, 3 ])
    get datasets_url

    assert_select 'button[disabled]', text: 'Load to case', count: 2, message: 'WANDS is still waiting for its scorer, Home Depot for its upload'
    assert_select 'a[href=?]', dataset_cases_path(dataset: 'haystack'), text: 'Load to case', count: 1

    Scorer.create!(name: 'WANDS Mine', owner: user, scale: [ 0, 1, 2 ])
    get datasets_url

    assert_select 'button[disabled]', text: 'Load to case', count: 1, message: 'only Home Depot, for its upload'
    assert_select 'a[href=?]', dataset_cases_path(dataset: 'wands'), text: 'Load to case', count: 1
  end

  test 'a scorer another user made for the dataset does not enable load to case' do
    Scorer.create!(name: 'Haystack Rating Party Theirs', owner: users(:doug), scale: [ 0, 1, 2, 3 ])
    get datasets_url

    assert_select 'button[disabled]', text: 'Load to case', count: 3
  end

  test 'the action buttons sit at the top of their cell, whatever the height of the row' do
    get datasets_url

    cells = css_select('tbody tr td:last-child')

    assert_equal 5, cells.size
    assert(cells.all? { |cell| cell['class'].split.include?('align-top') })
  end

  test 'the scorers header points to a note about needing a scorer compatible with the dataset labels' do
    get datasets_url

    assert_select 'th a[href="#scorer-note"]', text: '(1)'
    assert_select 'p#scorer-note', text: /needs a scorer compatible with the system of labels the dataset provides/
  end

  test 'index lists the scorers whose names start with the dataset name' do
    get datasets_url

    assert_equal([ '-' ] * 5, css_select('tbody tr td:nth-child(8)').map { |cell| cell.text.strip })

    own = Scorer.create!(name: 'Haystack Rating Party Scorer', owner: user, scale: [ 0, 1, 2, 3 ])
    shared = Scorer.create!(name: 'Haystack Rating Party AP', communal: true, scale: [ 0, 1 ])
    Scorer.create!(name: 'My Haystack Rating Party', owner: user, scale: [ 0, 1 ]) # the name is not a prefix
    Scorer.create!(name: 'Haystack Rating Party Theirs', owner: users(:doug), scale: [ 0, 1 ]) # not visible to this user
    get datasets_url

    haystack_row = css_select('tbody tr').find { |row| row.text.include?('Haystack Rating Party') && 'Haystack Rating Party' == row.at_css('td a').text }
    links = haystack_row.css('td a[href^="/scorers/"]')

    assert_equal [ 'Haystack Rating Party AP', 'Haystack Rating Party Scorer' ], links.map(&:text)
    assert_equal [ edit_scorer_path(shared), edit_scorer_path(own) ], links.pluck('href')
    assert_equal 'Haystack Rating Party AP, Haystack Rating Party Scorer', haystack_row.css('td')[7].text.squish, 'a comma separated list'
  end

  def create_ap
    Scorer.find_or_create_by!(name: 'AP@10') { |scorer| scorer.assign_attributes(scale: [ 0, 1 ], communal: true, code: 'setScore(1);') }
  end

  test 'index offers a create scorer dialog for each dataset with labels that is available' do
    get datasets_url

    assert_select 'button[data-bs-target=?]', '#createScorer-haystack', text: 'Create scorer', count: 1
    assert_select 'button[data-bs-target=?]', '#createScorer-wands', text: 'Create scorer', count: 1
    assert_select '#createScorer-imdb', count: 0
  end

  test 'the create scorer dialog asks which communal scorer to base it on, preselecting AP@10' do
    ap = create_ap
    get datasets_url

    assert_select 'form#create-scorer-form-haystack[action=?]', dataset_scorer_path('haystack') do
      assert_select 'select[name=template_id] option', count: Scorer.communal.count
      assert_select 'select[name=template_id] option[selected][value=?]', ap.id.to_s, text: 'AP@10'
    end
  end

  test 'the create scorer dialog leaves out the templates the user already made a scorer from' do
    ap = create_ap
    post dataset_scorer_url('haystack'), params: { template_id: ap.id }
    get datasets_url

    assert_select '#createScorer-haystack select[name=template_id] option', text: 'AP@10', count: 0
    assert_select '#createScorer-haystack select[name=template_id] option', count: Scorer.communal.count - 1
    assert_select '#createScorer-haystack select[name=template_id] option[selected]', count: 1
    assert_select '#createScorer-wands select[name=template_id] option', text: 'AP@10', count: 1, message: 'WANDS has not had a scorer made from AP@10'
  end

  test 'index disables create scorer when the user has a scorer from every template' do
    Scorer.communal.find_each { |template| post dataset_scorer_url('haystack'), params: { template_id: template.id } }
    get datasets_url

    assert_select 'span[title=?]', 'You already have a scorer from every communal scorer', count: 1
    assert_select '#createScorer-haystack', count: 0
  end

  test 'create scorer makes a custom scorer with the dataset labels, named after the dataset and the template' do
    template = create_ap

    assert_difference 'Scorer.count', 1 do
      post dataset_scorer_url('haystack'), params: { template_id: template.id }
    end

    scorer = Scorer.order(:id).last

    assert_redirected_to datasets_url
    assert_match(/Created the scorer Haystack Rating Party AP@10/, flash[:notice])
    assert_equal 'Haystack Rating Party AP@10', scorer.name
    assert_equal user, scorer.owner
    assert_not scorer.communal
    assert_equal [ 0, 1, 2, 3 ], scorer.scale
    assert_equal({ '0' => 'Poor', '1' => 'Fair', '2' => 'Good', '3' => 'Perfect' }, scorer.scale_with_labels)
    assert scorer.show_scale_labels
    assert_equal template.code, scorer.code
    assert_equal scorer, Dataset.find_by(owner: user, key: 'haystack').scorer
  end

  test 'create scorer builds on whichever communal scorer was picked, and a dataset can have one per template' do
    ndcg = Scorer.communal.find_by(name: 'nDCG@10') || Scorer.create!(name: 'nDCG@10', communal: true, scale: [ 0, 1, 2, 3 ], code: 'setScore(2);')
    ap = create_ap

    assert_difference 'Scorer.count', 2 do
      post dataset_scorer_url('haystack'), params: { template_id: ndcg.id }
      post dataset_scorer_url('haystack'), params: { template_id: ap.id }
    end

    mine = Scorer.where(owner: user).where('name LIKE ?', 'Haystack Rating Party %').order(:name)

    assert_equal [ 'Haystack Rating Party AP@10', 'Haystack Rating Party nDCG@10' ], mine.map(&:name)
    assert_equal [ ap.code, ndcg.code ], mine.map(&:code)
  end

  test 'create scorer does not make the same scorer twice' do
    ap = create_ap
    post dataset_scorer_url('haystack'), params: { template_id: ap.id }

    assert_no_difference 'Scorer.count' do
      post dataset_scorer_url('haystack'), params: { template_id: ap.id }
    end

    assert_match(/already have the scorer/, flash[:notice])
  end

  test 'create scorer needs a communal scorer as the template' do
    create_ap
    own = Scorer.create!(name: 'Mine', owner: user, scale: [ 0, 1 ])

    assert_no_difference 'Scorer.count' do
      post dataset_scorer_url('haystack')
      post dataset_scorer_url('haystack'), params: { template_id: 0 }
      post dataset_scorer_url('haystack'), params: { template_id: own.id }
    end

    assert_redirected_to datasets_url
    assert_match(/Pick a communal scorer/, flash[:alert])
  end

  test 'create scorer refuses a dataset without labels or one that is not available' do
    ap = create_ap

    assert_no_difference 'Scorer.count' do
      post dataset_scorer_url('imdb'), params: { template_id: ap.id }
      post dataset_scorer_url('esci'), params: { template_id: ap.id }
    end

    assert_redirected_to datasets_url
    assert_match(/no labels/, flash[:alert])
  end

  test 'index says under which licence each dataset comes, linking to its terms' do
    get datasets_url

    licences = css_select('tbody tr').to_h { |row| [ row.at_css('td a').text, row.css('td')[6].at_css('a') ] }

    assert_equal DatasetCatalog::ENTRIES.size, licences.size
    assert_equal([ 'MIT', 'https://github.com/wayfair/WANDS/blob/main/LICENSE', '_blank' ], licences['WANDS'].then { |a| [ a.text, a['href'], a['target'] ] })
    assert_equal 'Apache 2.0, as part of Quepid', licences['Haystack Rating Party'].text
    assert_equal 'Apache 2.0', licences['ESCI'].text
    assert_equal "The competition's rules, accepted on Kaggle", licences['Home Depot Product Search Relevance'].text
    assert_equal 'Personal and non-commercial use only', licences['IMDb Non-Commercial Datasets'].text
  end

  # Home Depot's files come from Kaggle, which wants a login and the rules accepted: the user uploads them.
  def kaggle_upload
    Rack::Test::UploadedFile.new(home_depot_zip, 'application/zip')
  end

  test 'Home Depot offers an upload, explaining that Kaggle wants a login and the rules accepted, and how to get the zip' do
    with_home_depot_upload do
      get datasets_url

      row = css_select('tbody tr').find { |tr| 'Home Depot Product Search Relevance' == tr.at_css('td a').text }

      assert_equal([ 'Upload data', 'Create scorer', 'Load to case' ], row.css('button').map { |button| button.text.strip })
      assert_equal '#uploadDataset-home_depot', row.at_css('button')['data-bs-target']
      assert row.css('button').last.key?('disabled'), 'Load to case waits for the upload'
      assert_equal 'Upload the data first: Quepid cannot download it from Kaggle', row.at_css('span[title^=Upload]')['title']
      assert_select '#uploadDataset-home_depot' do
        assert_select '.modal-body p', text: /Kaggle requires a login and acceptance of the competition rules/
        assert_select '.modal-body ol li', count: 4
        assert_select '.modal-body ol li a[href=?][target=_blank]', HomeDepotData::COMPETITION_URL
        assert_select '.modal-body ol li', text: /Rules.*accept/
        assert_select '.modal-body ol li', text: /Download All/
        assert_select 'form[action=?][enctype="multipart/form-data"] input[type=file][name=file][required]', dataset_upload_path('home_depot')
        assert_select '.modal-footer button[type=submit][form=upload-dataset-form-home_depot]', text: 'Upload'
        assert_select '.form-text', text: /only for the time of the import, and deletes them once they are imported/
      end
      assert_select 'span', text: /Files uploaded/, count: 0
    end
  end

  test 'upload keeps the Home Depot files, and the page then says they are there' do
    with_home_depot_upload do |directory|
      post dataset_upload_url('home_depot'), params: { file: kaggle_upload }

      assert_redirected_to datasets_url
      assert_equal 'Uploaded the Home Depot Product Search Relevance files.', flash[:notice]
      assert_predicate directory.join('train.csv'), :exist?

      get datasets_url

      assert_select 'span.text-success', text: /Files uploaded/
      assert_select '#uploadDataset-home_depot .form-text', text: /This upload replaces the files uploaded before/
    end
  end

  test 'upload says why it refuses a file, and needs one, and a dataset that takes uploads' do
    with_home_depot_upload do
      post dataset_upload_url('home_depot'), params: { file: Rack::Test::UploadedFile.new(StringIO.new('not a zip'), 'application/zip', original_filename: 'x.zip') }

      assert_match(/Could not use that upload: Quepid could not read that file as a zip/, flash[:alert])

      post dataset_upload_url('home_depot')

      assert_match(/Choose the zip of Home Depot Product Search Relevance to upload/, flash[:alert])

      post dataset_upload_url('wands'), params: { file: kaggle_upload }

      assert_match(/That dataset is not uploaded/, flash[:alert])
      assert_not HomeDepotData.uploaded?
    end
  end
end
