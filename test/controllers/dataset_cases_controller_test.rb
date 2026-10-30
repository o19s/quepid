# frozen_string_literal: true

require 'test_helper'

class DatasetCasesControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  let(:haystack) { DatasetCatalog.find('haystack') }

  setup do
    login_user_for_integration_test user
    # IMDb is listed as coming soon; its loading is kept working, so these tests turn it on.
    DatasetCatalog.find('imdb').available = true
  end

  teardown do
    DatasetCatalog.find('imdb').available = false
  end

  # What the Haystack export names as its scorer, so importing it works.
  def create_ndcg
    Scorer.find_or_create_by!(name: 'nDCG@10') { |scorer| scorer.assign_attributes(scale: (0..3).to_a, communal: true, code: 'setScore(1);') }
  end

  # The communal scorer the dataset scorer is copied from.
  def create_ap
    Scorer.find_or_create_by!(name: 'AP@10') { |scorer| scorer.assign_attributes(scale: [ 0, 1 ], communal: true, code: 'setScore(1);') }
  end

  def link_case dataset_key, name:, archived: false
    kase = Case.create!(case_name: name, owner: user, archived: archived)
    CaseToDataset.create!(dataset: Dataset.for(user, dataset_key), case: kase, status: 'done')
    kase
  end

  test 'index says so when no case was made from a dataset' do
    get dataset_cases_url

    assert_response :success
    assert_select 'ul.nav-tabs a.nav-link.active', text: 'Dataset Cases'
    assert_select 'p', text: /haven't made a case from a dataset yet/
    assert_select 'button[data-bs-target=?]', '#newDatasetCase', text: /Create new/
  end

  def make_endpoint name = 'Chorus'
    SearchEndpoint.create!(owner: user, name: name, search_engine: :solr, api_method: 'JSONP', endpoint_url: "http://example.com/#{name}/select")
  end

  test 'index offers to initiate indexing for each case with no search endpoint, with one dialog to pick it' do
    first = link_case('imdb', name: 'Nowhere')
    second = link_case('imdb', name: 'Nowhere either')
    has = link_case('imdb', name: 'Has one')
    has.tries.first.update!(search_endpoint: make_endpoint('Own'))
    chorus = make_endpoint
    make_endpoint('Archived').update!(archived: true)
    get dataset_cases_url

    assert_select 'button[data-bs-target="#initiateIndexing"]', text: 'Initiate indexing', count: 2
    [ first, second ].each do |kase|
      assert_select 'button[data-url=?][data-case-name=?]', dataset_case_index_path(CaseToDataset.find_by(case: kase)), kase.case_name
    end
    assert_select '#initiateIndexing', count: 1
    assert_select '#initiateIndexing[data-controller=initiate-indexing]'
    assert_select '#initiateIndexing form#initiate-indexing-form[method=get]' do
      assert_select 'input[name=authenticity_token]', count: 0
      assert_select 'select[name=search_endpoint_id] option[value=?]', chorus.id.to_s, text: 'Chorus'
      assert_select 'select[name=search_endpoint_id] option', text: 'Archived', count: 0
      assert_select 'a[href=?][target=_blank]', new_search_endpoint_path, text: 'Create a new search endpoint'
    end
  end

  test 'index shows how the indexing of a case documents is going, in the Indexed in column' do
    endpoint = make_endpoint
    states = { 'Pending' => { indexing_status: 'pending' }, 'Going' => { indexing_status: 'indexing', documents_indexed: 1200 },
               'Done' => { indexing_status: 'done', documents_indexed: 1558 }, 'Broken' => { indexing_status: 'failed', documents_indexed: 10, indexing_error: 'No can do' } }
    states.each do |name, attributes|
      link_case('haystack', name: name).tap { |kase| kase.tries.first.update!(search_endpoint: endpoint) }
      CaseToDataset.find_by(case: Case.find_by(case_name: name)).update!(attributes)
    end
    get dataset_cases_url

    rows = css_select('tbody tr').index_by { |row| row.at_css('td a').text }

    assert_match(/Indexing documents/, rows['Pending'].css('td')[3].text)
    assert_match(/Indexing documents \(1,200 so far\)/, rows['Going'].css('td')[3].text)
    assert_match(/1,558 documents indexed/, rows['Done'].css('td')[3].text)
    assert_select 'span.badge[title=?]', 'No can do', text: 'Indexing failed'
    assert_select '[data-controller=loading-refresh]', count: 1
  end

  test 'index does not refresh itself once the indexing is over' do
    kase = link_case('haystack', name: 'Done')
    kase.tries.first.update!(search_endpoint: make_endpoint)
    CaseToDataset.find_by(case: kase).update!(indexing_status: 'done', documents_indexed: 3)
    get dataset_cases_url

    assert_select '[data-controller=loading-refresh]', count: 0
  end

  test 'index marks a case whose endpoint is where its dataset was already indexed as preindexed' do
    chorus = make_endpoint('Chorus').tap { |endpoint| endpoint.update!(search_engine: 'solr', endpoint_url: 'http://chorus.dev.o19s.com:8983/solr/ecommerce/select') }
    kase = link_case('haystack', name: 'On Chorus')
    kase.tries.first.update!(search_endpoint: chorus)
    other = link_case('haystack', name: 'On another')
    other.tries.first.update!(search_endpoint: make_endpoint('Another'))
    get dataset_cases_url

    rows = css_select('tbody tr').index_by { |row| row.at_css('td a').text }

    assert_match(/preindexed: the documents were already there/, rows['On Chorus'].css('td')[3].text)
    assert_no_match(/preindexed/, rows['On another'].css('td')[3].text)
    assert_match(/Change backend/, rows['On Chorus'].css('td')[3].text)
  end

  test 'Initiate indexing and Change backend look the same: plain links' do
    link_case('imdb', name: 'Nowhere')
    has = link_case('imdb', name: 'Has its own')
    has.tries.first.update!(search_endpoint: make_endpoint('Own'))
    get dataset_cases_url

    assert_select 'button.btn-link.btn-sm.p-0[data-bs-target="#initiateIndexing"]', text: 'Initiate indexing', count: 1
    assert_select 'button.btn-link.btn-sm.p-0[data-bs-target="#initiateIndexing"]', text: 'Change backend', count: 1
    assert_select 'button.btn-outline-primary', text: 'Initiate indexing', count: 0
  end

  test 'index offers Change backend, not Initiate indexing, for a case that has an endpoint, sharing the one dialog' do
    with_own = link_case('imdb', name: 'Has its own')
    with_own.tries.first.update!(search_endpoint: make_endpoint('Own'))
    link = CaseToDataset.find_by(case: with_own)
    get dataset_cases_url

    assert_select 'td a', text: 'Own'
    assert_select 'button', text: 'Initiate indexing', count: 0
    assert_select 'button[data-bs-target="#initiateIndexing"][data-url=?][data-case-name=?]', dataset_case_index_path(link), 'Has its own', text: 'Change backend'
    assert_select '#initiateIndexing', count: 1
  end

  test 'index does not offer Change backend while a case is loading or its documents are being indexed' do
    loading = link_case('imdb', name: 'Loading')
    CaseToDataset.find_by(case: loading).update!(status: 'loading')
    busy = link_case('imdb', name: 'Busy')
    busy.tries.first.update!(search_endpoint: make_endpoint('Busy one'))
    CaseToDataset.find_by(case: busy).update!(indexing_status: 'indexing', documents_indexed: 5)
    get dataset_cases_url

    assert_select 'button', text: 'Change backend', count: 0
  end

  test 'index disables initiate indexing while a case is still loading' do
    kase = link_case('imdb', name: 'Busy')
    CaseToDataset.find_by(case: kase).update!(status: 'loading')
    get dataset_cases_url

    assert_select 'button[disabled]', text: 'Initiate indexing', count: 1
    assert_select 'button[data-bs-target="#initiateIndexing"]', count: 0
  end

  test 'the initiate indexing dialog points to creating a search endpoint when the user has none' do
    link_case('imdb', name: 'Nowhere')
    SearchEndpoint.for_user(user).update_all(archived: true) # whatever the fixtures gave this user
    get dataset_cases_url

    assert_select '#initiateIndexing a[href=?]', new_search_endpoint_path
    assert_select '#initiateIndexing button[type=submit]', count: 0
  end

  test 'endpoint points one case at the chosen search endpoint and leaves the others alone' do
    chosen = link_case('imdb', name: 'Chosen')
    other = link_case('imdb', name: 'Other')
    endpoint = make_endpoint

    post endpoint_dataset_case_url(CaseToDataset.find_by(case: chosen)), params: { search_endpoint_id: endpoint.id }

    assert_redirected_to dataset_cases_url
    assert_match(/Chosen now searches Chorus/, flash[:notice])
    assert_equal endpoint, chosen.tries.first.reload.search_endpoint
    assert_nil other.tries.first.reload.search_endpoint
    get dataset_cases_url

    assert_select 'td a[href=?]', search_endpoint_path(endpoint), text: 'Chorus', count: 1
    assert_select 'button', text: 'Initiate indexing', count: 1
  end

  test 'the dialog only looks: it submits a GET to the review page, so it has no token to go stale' do
    link_case('imdb', name: 'Nowhere')
    get dataset_cases_url

    assert_select '#initiate-indexing-form[method=get]'
    assert_select '#initiate-indexing-form input[name=authenticity_token]', count: 0
    assert_select 'button[type=submit][form=initiate-indexing-form]', text: 'Review index definition'
  end

  test 'endpoint changes the latest try only, and does not index or create anything' do
    kase = link_case('imdb', name: 'Two tries')
    kase.tries.create!(try_number: 2)
    endpoint = make_endpoint

    assert_no_difference [ 'Case.count', 'Scorer.count', 'Query.count', 'Try.count' ] do
      post endpoint_dataset_case_url(CaseToDataset.find_by(case: kase)), params: { search_endpoint_id: endpoint.id }
    end

    assert_equal endpoint, kase.tries.reload.first.search_endpoint
    assert_equal [ nil ], kase.tries.reload.drop(1).map(&:search_endpoint)
  end

  test 'endpoint refuses an endpoint the user cannot use, an archived one, or none' do
    kase = link_case('imdb', name: 'Picky')
    link = CaseToDataset.find_by(case: kase)
    theirs = make_endpoint('Theirs').tap { |endpoint| endpoint.update!(owner: users(:doug)) }
    archived = make_endpoint('Old').tap { |endpoint| endpoint.update!(archived: true) }

    [ theirs.id, archived.id, 0, nil ].each do |id|
      post endpoint_dataset_case_url(link), params: { search_endpoint_id: id }

      assert_redirected_to dataset_cases_url
      assert_match(/Pick a search endpoint/, flash[:alert])
    end

    assert_nil kase.tries.first.reload.search_endpoint
  end

  test 'endpoint refuses a case that is still loading' do
    kase = link_case('imdb', name: 'Busy')
    link = CaseToDataset.find_by(case: kase)
    link.update!(status: 'loading')

    post endpoint_dataset_case_url(link), params: { search_endpoint_id: make_endpoint.id }

    assert_match(/still loading/, flash[:alert])
    assert_nil kase.tries.first.reload.search_endpoint
  end

  test 'endpoint does not touch another users case, or a case that is no longer the users own' do
    other = Case.create!(case_name: 'Theirs', owner: users(:doug))
    their_link = CaseToDataset.create!(dataset: Dataset.for(users(:doug), 'imdb'), case: other, status: 'done')
    endpoint = make_endpoint

    post endpoint_dataset_case_url(their_link), params: { search_endpoint_id: endpoint.id }

    assert_response :not_found
    assert_nil other.tries.first.reload.search_endpoint

    taken = link_case('imdb', name: 'Taken over')
    taken.update!(owner: users(:doug))
    post endpoint_dataset_case_url(CaseToDataset.find_by(case: taken)), params: { search_endpoint_id: endpoint.id }

    assert_match(/belongs to someone else/, flash[:alert])
    assert_nil taken.tries.first.reload.search_endpoint
  end

  test 'index has an uninstall button per case, asking first, disabled while the case is still loading' do
    done = link_case('imdb', name: 'Done one')
    loading = link_case('imdb', name: 'Still loading')
    CaseToDataset.find_by(case: loading).update!(status: 'loading')
    get dataset_cases_url

    link = CaseToDataset.find_by(case: done)

    assert_select 'form[action=?][data-turbo-confirm*=?]', dataset_case_path(link), 'Uninstall Done one?' do
      assert_select 'input[name=_method][value=delete]'
      assert_select 'button', text: 'Uninstall'
    end
    assert_select 'button[disabled]', text: 'Uninstall', count: 1
    assert_select 'span[title*=?]', 'uninstall it when that has finished', count: 1
  end

  test 'uninstall deletes the case, its queries and ratings and the link, but keeps the book and scorer' do
    scorer = scorers(:'p@10')
    book = books(:book_of_star_wars_judgements)
    kase = link_case('imdb', name: 'Going away')
    kase.update!(scorer: scorer, book: book)
    query = kase.queries.create!(query_text: 'rambo')
    query.ratings.create!(doc_id: 'a', rating: 1)
    link = CaseToDataset.find_by(case: kase)

    assert_difference [ 'Case.count', 'Query.count', 'Rating.count', 'CaseToDataset.count' ], -1 do
      delete dataset_case_url(link)
    end

    assert_redirected_to dataset_cases_url
    assert_match(/Uninstalled Going away/, flash[:notice])
    assert Scorer.exists?(scorer.id)
    assert Book.exists?(book.id)
  end

  test 'uninstall refuses a case that is still loading' do
    kase = link_case('imdb', name: 'Busy')
    link = CaseToDataset.find_by(case: kase)
    link.update!(status: 'loading')

    assert_no_difference [ 'Case.count', 'CaseToDataset.count' ] do
      delete dataset_case_url(link)
    end

    assert_redirected_to dataset_cases_url
    assert_match(/still loading/, flash[:alert])
  end

  test 'uninstall can clean up a case whose loading failed' do
    kase = link_case('imdb', name: 'Broke')
    link = CaseToDataset.find_by(case: kase)
    link.update!(status: 'failed', error: 'boom')

    assert_difference 'Case.count', -1 do
      delete dataset_case_url(link)
    end
  end

  test 'uninstall does not touch another users dataset case' do
    other = Case.create!(case_name: 'Theirs', owner: users(:doug))
    link = CaseToDataset.create!(dataset: Dataset.for(users(:doug), 'imdb'), case: other, status: 'done')

    assert_no_difference [ 'Case.count', 'CaseToDataset.count' ] do
      delete dataset_case_url(link)
    end

    assert_response :not_found
  end

  test 'uninstall refuses a case that is no longer the users own' do
    kase = link_case('imdb', name: 'Taken over')
    kase.update!(owner: users(:doug))
    link = CaseToDataset.find_by(case: kase)

    assert_no_difference [ 'Case.count', 'CaseToDataset.count' ] do
      delete dataset_case_url(link)
    end

    assert_match(/belongs to someone else/, flash[:alert])
  end

  test 'index quietly drops the links of cases that were deleted' do
    kept = link_case('imdb', name: 'Kept')
    deleted = link_case('imdb', name: 'Deleted')
    deleted.destroy

    assert_difference 'CaseToDataset.count', -1 do
      get dataset_cases_url
    end

    assert_response :success
    assert_select 'tbody tr', count: 1
    assert_select 'td a[href=?]', case_core_path(kept)
    assert_nil CaseToDataset.find_by(case_id: deleted.id)
  end

  test 'index lists the cases made from datasets, without archived ones or other users cases' do
    kase = link_case('imdb', name: 'My movies')
    kase.queries.create!(query_text: 'rambo')
    link_case('imdb', name: 'Old movies', archived: true)
    other = Case.create!(case_name: 'Not mine', owner: users(:doug))
    CaseToDataset.create!(dataset: Dataset.for(users(:doug), 'imdb'), case: other)
    get dataset_cases_url

    assert_select 'tbody tr', count: 1
    assert_select 'td a[href=?]', case_core_path(kase), text: 'My movies'
    assert_select 'td', text: 'IMDb Non-Commercial Datasets'
    assert_select 'td', text: kase.scorer.name
    assert_select 'td', text: '1'
  end

  test 'index shows the case scorer and search endpoint as columns' do
    scorer = scorers(:'p@10')
    kase = link_case('imdb', name: 'With endpoint')
    kase.update!(scorer: scorer)
    endpoint = SearchEndpoint.create!(owner: user, name: 'Chorus', search_engine: :solr, api_method: 'JSONP', endpoint_url: 'http://example.com/select')
    kase.tries.first.update!(search_endpoint: endpoint)
    get dataset_cases_url

    [ 'Case', 'Dataset', 'Scorer', 'Indexed in', 'Documents', 'Created' ].each { |heading| assert_select 'th', text: heading }
    assert_select 'th', text: /\AQueries/
    assert_select 'td a[href=?]', edit_scorer_path(scorer), text: scorer.name
    assert_select 'td a[href=?]', search_endpoint_path(endpoint), text: 'Chorus'
  end

  test 'index counts the distinct documents rated in a case or in its judgement book' do
    book = books(:book_of_star_wars_judgements)
    book_docs = book.query_doc_pairs.distinct.pluck(:doc_id)
    kase = link_case('imdb', name: 'With docs')
    kase.update!(book: book)
    query = kase.queries.create!(query_text: 'star wars')
    [ book_docs.first, 'only-rated-1', 'only-rated-2' ].each { |doc_id| query.ratings.create!(doc_id: doc_id, rating: 1) }
    other = kase.queries.create!(query_text: 'rambo')
    other.ratings.create!(doc_id: 'only-rated-1', rating: 2)
    link_case('imdb', name: 'No docs')
    get dataset_cases_url

    assert_select 'th', text: 'Documents'
    rows = css_select('tbody tr').index_by { |row| row.at_css('td a').text }

    assert_equal (book_docs.size + 2).to_s, rows['With docs'].css('td')[5].text.strip
    assert_equal '0', rows['No docs'].css('td')[5].text.strip
  end

  test 'index shows no document count while a case is loading' do
    kase = link_case('imdb', name: 'Still loading')
    CaseToDataset.find_by(case: kase).update!(status: 'loading')
    get dataset_cases_url

    assert_equal '—', css_select('tbody tr td')[5].text.strip
  end

  test 'index shows a case still loading, or one that failed, in place of its query count' do
    loading = link_case('imdb', name: 'Still loading')
    CaseToDataset.find_by(case: loading).update!(status: 'loading')
    broken = link_case('imdb', name: 'Broke')
    CaseToDataset.find_by(case: broken).update!(status: 'failed', error: 'The export is broken')
    get dataset_cases_url

    assert_select 'td', text: /Loading in the background/, count: 1
    assert_select 'span.badge[title=?]', 'The export is broken', text: 'Failed'
    assert_select '[data-controller=loading-refresh]', count: 1
  end

  test 'index does not refresh itself when nothing is loading' do
    link_case('imdb', name: 'Done one')
    get dataset_cases_url

    assert_select '[data-controller=loading-refresh]', count: 0
  end

  test 'the create dialog asks for the dataset, case name and scorer' do
    get dataset_cases_url

    assert_select 'form#new-dataset-case-form[action=?]', dataset_cases_path do
      assert_select 'select[name=dataset] option', count: 3
      assert_select 'select[name=dataset] option[selected]', text: /Haystack/
      assert_select 'input[name=case_name][value=?]', 'Haystack Rating Party'
      assert_select 'select[name=scorer_id]', count: 3
    end
  end

  test 'the create dialog opens on the dataset the Datasets tab asked for' do
    get dataset_cases_url(dataset: 'imdb')

    assert_select 'form[data-dataset-case-form-open-value=true]'
    assert_select 'select[name=dataset] option[selected]', text: /IMDb/
    assert_select 'input[name=case_name][value=?]', ImdbDataset::CASE_NAME
    assert_select '[data-dataset-key=imdb]:not([hidden]) select:not([disabled])'
    assert_select '[data-dataset-key=haystack][hidden] select[disabled]'
  end

  test 'the create dialog stays closed without a dataset in the url' do
    get dataset_cases_url

    assert_select 'form[data-dataset-case-form-open-value=false]'
  end

  test 'the create dialog offers to create the dataset scorer when the user has none' do
    get dataset_cases_url

    assert_select '#scorer_id_haystack option[value=new][selected]', text: /Create the scorer Haystack Rating Party AP@10 \(0 Poor, 1 Fair, 2 Good, 3 Perfect\)/
    assert_select '#scorer_id_haystack option[disabled]', text: /P@10 \(scale 0, 1, doesn't fit\)/
    assert_select '#scorer_id_imdb option[value=new]', count: 0
  end

  test 'a communal scorer with the same labels does not stand in for the dataset scorer' do
    Scorer.create!(name: 'Poor to Perfect', scale: (0..3).to_a, communal: true,
                   scale_with_labels: { '0' => 'Poor', '1' => 'Fair', '2' => 'Good', '3' => 'Perfect' })
    get dataset_cases_url

    assert_select '#scorer_id_haystack option[value=new][selected]'
  end

  test 'the create dialog lists the dataset scorers first, then the others' do
    create_ap
    own = DatasetScorer.new(user).find_or_create(haystack)
    mine = Scorer.create!(name: 'Haystack Rating Party Mine', owner: user, scale: [ 0, 1, 2, 3 ])
    get dataset_cases_url

    groups = css_select('#scorer_id_haystack optgroup')

    assert_equal [ 'Scorers for Haystack Rating Party', 'Other scorers' ], groups.pluck('label')
    assert_equal [ own.name, mine.name ].sort, groups.first.css('option').map(&:text).sort
    assert(groups.last.css('option').none? { |option| option.text.start_with?('Haystack Rating Party') })
    assert_includes groups.last.css('option').map(&:text), 'AP@10 (scale 0, 1, doesn\'t fit)'
  end

  test 'the create dialog puts the create option in the dataset group and leaves a flat list for a dataset with no scorers of its own' do
    get dataset_cases_url

    assert_select '#scorer_id_haystack optgroup[label=?] option[value=new]', 'Scorers for Haystack Rating Party', count: 1
    assert_select '#scorer_id_imdb optgroup', count: 0
    assert_select '#scorer_id_imdb option', minimum: 1
  end

  test 'the create dialog preselects the dataset scorer once the user has it' do
    create_ap
    own = DatasetScorer.new(user).find_or_create(haystack)
    get dataset_cases_url

    assert_select '#scorer_id_haystack option[value=new]', count: 0
    assert_select '#scorer_id_haystack option[selected][value=?]', own.id.to_s
  end

  test 'create makes the case at once and leaves loading its queries to a background job' do
    assert_difference 'Case.count', 1 do
      assert_enqueued_with(job: LoadDatasetCaseJob) do
        post dataset_cases_url, params: { dataset: 'imdb', case_name: 'My movies', scorer_id: scorers(:'p@10').id }
      end
    end

    kase = Case.order(:id).last

    assert_redirected_to dataset_cases_url
    assert_match(/loading in the background/, flash[:notice])
    assert_equal 'My movies', kase.case_name
    assert_equal user, kase.owner
    assert_equal scorers(:'p@10'), kase.scorer
    assert_equal 0, kase.queries.count
    link = CaseToDataset.find_by(case: kase)

    assert_equal 'pending', link.status
    assert_equal 'imdb', link.dataset.key
    assert_nil kase.options
  end

  test 'create does not touch the dataset itself before the job runs' do
    assert_no_difference [ 'Book.count', 'Query.count' ] do
      post dataset_cases_url, params: { dataset: 'imdb' }
    end
  end

  test 'the job loads the IMDb queries with no search endpoint' do
    perform_enqueued_jobs do
      post dataset_cases_url, params: { dataset: 'imdb', case_name: 'My movies' }
    end

    kase = Case.order(:id).last

    assert_equal ImdbDataset::QUERIES, kase.queries.order(:arranged_at).map(&:query_text)
    assert_equal 0, kase.queries.joins(:ratings).count
    assert_nil kase.tries.first.search_endpoint
    assert_equal 'done', CaseToDataset.find_by(case: kase).status
    assert_equal [ kase ], Dataset.find_by(owner: user, key: 'imdb').cases.to_a
  end

  test 'create passes a sample size to the job and says so in the default case name' do
    assert_enqueued_with(job: LoadDatasetCaseJob) do
      post dataset_cases_url, params: { dataset: 'imdb', sample_size: '4' }
    end

    kase = Case.order(:id).last

    assert_equal "#{ImdbDataset::CASE_NAME} (sample of 4)", kase.case_name
    assert_equal 4, enqueued_jobs.last[:args].last
  end

  test 'create remembers that a case is only a sample, and not when it is the whole dataset' do
    post dataset_cases_url, params: { dataset: 'imdb', sample_size: '4' }
    post dataset_cases_url, params: { dataset: 'imdb', sample_size: ImdbDataset::QUERIES.size.to_s }
    post dataset_cases_url, params: { dataset: 'imdb' }

    assert_equal [ 4, nil, nil ], CaseToDataset.order(:id).last(3).map(&:sample_size)
  end

  test 'the queries header points to a note about how a sampled case is shown' do
    link_case('imdb', name: 'One')
    get dataset_cases_url

    assert_select 'th a[href="#queries-note"]', text: '(1)'
    assert_select 'p#queries-note', text: %r{For a case made from a sample of a dataset.*shown over how many the dataset has, like 4 / 10}m
  end

  test 'there is no queries note when there are no cases to explain' do
    get dataset_cases_url

    assert_select 'p#queries-note', count: 0
  end

  test 'index shows a sample as loaded over total, and a whole dataset as a plain number' do
    sample = link_case('imdb', name: 'Sample')
    CaseToDataset.find_by(case: sample).update!(sample_size: 3)
    3.times { |i| sample.queries.create!(query_text: "q#{i}") }
    whole = link_case('imdb', name: 'Whole')
    ImdbDataset::QUERIES.each { |text| whole.queries.create!(query_text: text) }
    get dataset_cases_url

    rows = css_select('tbody tr').index_by { |row| row.at_css('td a').text }

    assert_equal "3 / #{ImdbDataset::QUERIES.size}", rows['Sample'].css('td')[4].text.squish
    assert_equal ImdbDataset::QUERIES.size.to_s, rows['Whole'].css('td')[4].text.squish
  end

  test 'create keeps a name the user typed when sampling' do
    post dataset_cases_url, params: { dataset: 'imdb', sample_size: '4', case_name: 'Four movies' }

    assert_equal 'Four movies', Case.order(:id).last.case_name
  end

  test 'create loads everything when the sample is as big as the dataset, or none is asked for' do
    post dataset_cases_url, params: { dataset: 'imdb', sample_size: ImdbDataset::QUERIES.size.to_s }
    post dataset_cases_url, params: { dataset: 'imdb', sample_size: '' }

    assert_equal([ nil, nil ], enqueued_jobs.map { |job| job[:args].last })
    assert_equal [ ImdbDataset::CASE_NAME ] * 2, Case.order(:id).last(2).map(&:case_name)
  end

  test 'create refuses a sample size that is not a whole number of at least 1' do
    [ '0', '-3', 'ten', '2.5' ].each do |bad|
      assert_no_difference 'Case.count' do
        post dataset_cases_url, params: { dataset: 'imdb', sample_size: bad }
      end

      assert_redirected_to dataset_cases_url
      assert_match(/whole number of at least 1/, flash[:alert])
    end
  end

  test 'the create dialog has a sample size per dataset, limited to its queries' do
    get dataset_cases_url

    assert_select '[data-dataset-key=haystack] input[name=sample_size][max=137][min=1]'
    assert_select '[data-dataset-key=imdb] input[name=sample_size][max=?]', ImdbDataset::QUERIES.size.to_s
    assert_select '[data-dataset-key=imdb][hidden] input[name=sample_size][disabled]'
    assert_select '[data-dataset-key=haystack]:not([hidden]) input[name=sample_size]:not([disabled])'
  end

  test 'create falls back to the default name and scorer' do
    post dataset_cases_url, params: { dataset: 'imdb' }

    kase = Case.order(:id).last

    assert_equal ImdbDataset::CASE_NAME, kase.case_name
    assert_not_nil kase.scorer
  end

  test 'the job loads the Haystack case and book, and its scorer, without inviting the original raters' do
    create_ndcg
    create_ap

    assert_difference [ 'Case.count', 'Book.count', 'Scorer.count' ], 1 do
      assert_no_difference 'User.count' do
        perform_enqueued_jobs do
          post dataset_cases_url, params: { dataset: 'haystack', scorer_id: 'new' }
        end
      end
    end

    kase = Case.order(:id).last

    assert_equal 'Haystack Rating Party', kase.case_name
    assert_equal user, kase.owner
    assert_not_nil kase.book
    assert_equal 137, kase.queries.count
    assert_equal 'Haystack Rating Party AP@10', kase.scorer.name
    assert_equal user, kase.scorer.owner
    assert_equal({ '0' => 'Poor', '1' => 'Fair', '2' => 'Good', '3' => 'Perfect' }, kase.scorer.scale_with_labels)
    assert_equal 'done', CaseToDataset.find_by(case: kase).status
  end

  test 'create reuses the dataset scorer it built before' do
    create_ap

    assert_difference 'Scorer.count', 1 do
      post dataset_cases_url, params: { dataset: 'haystack', scorer_id: 'new' }
    end

    assert_no_difference 'Scorer.count' do
      post dataset_cases_url, params: { dataset: 'haystack', scorer_id: 'new' }
    end
  end

  test 'create refuses a new scorer for a dataset without labels' do
    assert_no_difference [ 'Case.count', 'Scorer.count' ] do
      post dataset_cases_url, params: { dataset: 'imdb', scorer_id: 'new' }
    end

    assert_redirected_to dataset_cases_url
    assert_match(/doesn't declare labels/, flash[:alert])
  end

  test 'create refuses a scorer whose scale does not fit the dataset' do
    assert_no_difference 'Case.count' do
      post dataset_cases_url, params: { dataset: 'haystack', scorer_id: scorers(:'p@10').id }
    end

    assert_redirected_to dataset_cases_url
    assert_match(/can't rate every label/, flash[:alert])
  end

  test 'create refuses a scorer the user cannot see' do
    assert_no_difference 'Case.count' do
      post dataset_cases_url, params: { dataset: 'imdb', scorer_id: 0 }
    end

    assert_redirected_to dataset_cases_url
  end

  test 'create refuses a dataset that is not available, or none' do
    assert_no_difference 'Case.count' do
      post dataset_cases_url, params: { dataset: 'esci' }
      post dataset_cases_url
    end

    assert_redirected_to dataset_cases_url
  end

  test 'the create dialog offers WANDS, with its name, up to 480 queries to sample, and a scorer to create' do
    get dataset_cases_url(dataset: 'wands')

    assert_select 'select[name=dataset] option[value=wands][selected]', text: /WANDS/
    assert_select 'input[name=case_name][value=?]', 'WANDS'
    assert_select '[data-dataset-key=wands] input[name=sample_size][max=480][min=1]'
    assert_select '#scorer_id_wands option[value=new][selected]', text: /Create the scorer WANDS AP@10 \(0 Irrelevant, 1 Partial, 2 Exact\)/
  end

  test 'create makes a WANDS case and its scorer with the three WANDS labels, and queues the download and loading' do
    Scorer.find_or_create_by!(name: 'AP@10') { |scorer| scorer.assign_attributes(scale: [ 0, 1 ], communal: true, code: 'setScore(1);') }

    assert_difference [ 'Case.count', 'Scorer.count' ], 1 do
      assert_enqueued_with(job: LoadDatasetCaseJob) do
        post dataset_cases_url, params: { dataset: 'wands', scorer_id: 'new', sample_size: '25' }
      end
    end

    kase = Case.order(:id).last
    link = CaseToDataset.find_by(case: kase)

    assert_equal 'WANDS (sample of 25)', kase.case_name
    assert_equal 'WANDS AP@10', kase.scorer.name
    assert_equal [ 0, 1, 2 ], kase.scorer.scale
    assert_equal({ '0' => 'Irrelevant', '1' => 'Partial', '2' => 'Exact' }, kase.scorer.scale_with_labels)
    assert_equal [ 'wands', 25, 'pending' ], [ link.dataset.key, link.sample_size, link.status ]
    assert_equal 0, kase.queries.count, 'the queries come from the background job, after the download'
  end

  test 'a sample as big as WANDS is the whole of it' do
    Scorer.find_or_create_by!(name: 'AP@10') { |scorer| scorer.assign_attributes(scale: [ 0, 1 ], communal: true, code: 'setScore(1);') }
    post dataset_cases_url, params: { dataset: 'wands', scorer_id: 'new', sample_size: '480' }

    assert_nil CaseToDataset.order(:id).last.sample_size
  end

  test 'a WANDS case lists its rated products as documents, and a sample as loaded over total' do
    kase = link_case('wands', name: 'WANDS')
    query = kase.queries.create!(query_text: 'salon chair')
    %w[0 1 2].each { |doc_id| query.ratings.create!(doc_id: doc_id, rating: 1) }
    CaseToDataset.find_by(case: kase).update!(sample_size: 1)
    get dataset_cases_url

    row = css_select('tbody tr').find { |tr| 'WANDS' == tr.at_css('td a').text }

    assert_equal '1 / 480', row.css('td')[4].text.squish
    assert_equal '3', row.css('td')[5].text.squish
  end
end
