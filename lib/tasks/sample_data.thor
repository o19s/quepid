# frozen_string_literal: true

require 'colorize'
require 'zip'

# rubocop:disable Style/StringConcatenation
class SampleData < Thor
  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/BlockLength
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/PerceivedComplexity

  desc 'sample_data', 'load the sample data'
  long_desc <<-LONGDESC
  `sample_data`

  EXAMPLES:

  $ thor sample_data
  LONGDESC
  def sample_data
    load_environment

    # Search Endpoints
    print_step 'Seeding search endpoints................'

    statedecoded_solr_endpoint = ::SearchEndpoint.find_or_create_by search_engine: :solr,
                                                                    endpoint_url: 'http://quepid-solr.dev.o19s.com:8985/solr/statedecoded/select', api_method: 'JSONP'
    tmdb_solr_endpoint = ::SearchEndpoint.find_or_create_by name: 'TMDB Solr', search_engine: :solr,
                                                            endpoint_url: 'http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select', api_method: 'JSONP'

    tmdb_es_endpoint = ::SearchEndpoint.find_or_create_by   search_engine: :es,
                                                            endpoint_url: 'http://quepid-elasticsearch.dev.o19s.com:9206/tmdb/_search', api_method: 'POST'

    ::SearchEndpoint.find_or_create_by search_engine:  :search_api,
                                       endpoint_url:   'https://opensourceconnections.com/?s=eric',
                                       api_method:     'GET',
                                       proxy_requests: true

    search_api_endpoint = ::SearchEndpoint.find_or_create_by search_engine: :searchapi,
                                                             name: 'Edinburgh University Website',
                                                             endpoint_url: 'https://search.ed.ac.uk', api_method: 'GET',
                                                             proxy_requests: true,
                                                             test_query: 'q=mental',
                                                             mapper_code: File.read(Rails.root.join('test/fixtures/files/edinburgh_uni_searchapi_mapper_code.js'))

    static_endpoint = ::SearchEndpoint.find_or_create_by search_engine: :static,
                                                         name: 'Static Endpoint',
                                                         endpoint_url: 'TO_BE_UPDATED', api_method: 'GET'

    print_step 'End of seeding search endpoints................'

    # Users
    print_step 'Seeding users................'

    ######################################
    # Defaults
    ######################################

    search_url = 'http://quepid-solr.dev.o19s.com:8985/solr/statedecoded/select'

    user_defaults = user_default_params

    try_defaults = try_default_params

    ######################################
    # Admin User
    ######################################

    user_specifics = {
      administrator: true,
      name:          'Admin User',
      email:         'quepid+admin@o19s.com',
    }
    user_params = user_defaults.merge(user_specifics)
    seed_user user_params
    print_user_info user_params

    ######################################
    # User with ES Case
    ######################################

    user_specifics = {
      name:  'User with ES Case',
      email: 'quepid+es@o19s.com',
    }
    user_params = user_defaults.merge(user_specifics)
    seed_user user_params
    print_user_info user_params

    ######################################
    # User with Realistic Activity in Quepid
    ######################################

    user_specifics = {
      name:          'User with Realistic Activity in Quepid',
      email:         'quepid+realisticActivity@o19s.com',
      administrator: true,
    }
    user_params = user_defaults.merge(user_specifics)
    realistic_activity_user = seed_user user_params
    print_user_info user_params

    # go ahead and assign the end point to this person.
    tmdb_solr_endpoint.owner = realistic_activity_user
    tmdb_es_endpoint.owner = realistic_activity_user
    search_api_endpoint.owner = realistic_activity_user
    static_endpoint.owner = realistic_activity_user

    statedecoded_solr_endpoint.save
    tmdb_solr_endpoint.save
    tmdb_es_endpoint.save
    search_api_endpoint.save
    static_endpoint.save

    ######################################
    # OSC Team Owner
    ######################################

    user_specifics = {
      name:  'OSC Team Owner',
      email: 'quepid+oscOwner@o19s.com',
    }
    user_params    = user_defaults.merge(user_specifics)
    osc_owner_user = seed_user user_params
    print_user_info user_params

    ######################################
    # OSC Team Member
    ######################################

    user_specifics = {
      name:  'OSC Team Member',
      email: 'quepid+oscMember@o19s.com',
    }
    user_params     = user_defaults.merge(user_specifics)
    osc_member_user = seed_user user_params
    print_user_info user_params

    ######################################
    # OSC AI Judge (Ollama)
    ######################################

    user_specifics = {
      name:          'OSC AI Judge',
      llm_key:       'key123456',
      system_prompt: AiJudgesController::DEFAULT_SYSTEM_PROMPT,
    }
    user_params = user_specifics # user_defaults.merge(user_specifics)
    osc_ai_judge = seed_user user_params
    osc_ai_judge.judge_options = {
      llm_provider:    'ollama',
      llm_service_url: 'http://ollama:31434',
      llm_model:       'qwen3:0.6b',
      llm_timeout:     60,
    }
    osc_ai_judge.save!
    print_user_info user_params

    ######################################
    # Azure OpenAI AI Judge
    ######################################

    user_specifics = {
      name:          'Azure OpenAI Judge',
      llm_key:       'your-azure-openai-key',
      system_prompt: AiJudgesController::DEFAULT_SYSTEM_PROMPT,
    }
    user_params = user_specifics
    azure_openai_judge = seed_user user_params
    azure_openai_judge.judge_options = {
      llm_provider:    'azure_openai',
      llm_service_url: 'https://YOUR-RESOURCE.openai.azure.com/openai/v1',
      llm_model:       'gpt-4.1',
      llm_timeout:     30,
    }
    azure_openai_judge.save!
    print_step "Seeded AI judge: name: #{user_specifics[:name]}"

    ######################################
    # Azure AI Foundry Anthropic Judge
    ######################################

    user_specifics = {
      name:          'Azure Anthropic Judge',
      llm_key:       'your-azure-ai-services-key',
      system_prompt: AiJudgesController::DEFAULT_SYSTEM_PROMPT,
    }
    user_params = user_specifics
    azure_anthropic_judge = seed_user user_params
    azure_anthropic_judge.judge_options = {
      llm_provider:    'azure_ai_foundry_anthropic',
      llm_service_url: 'https://YOUR-RESOURCE.services.ai.azure.com/anthropic',
      llm_model:       'claude-3-5-haiku-20241022',
      llm_timeout:     30,
    }
    azure_anthropic_judge.save!
    print_step "Seeded AI judge: name: #{user_specifics[:name]}"

    print_step 'End of seeding users................'

    # Cases
    print_step 'Seeding cases................'

    ######################################
    # Solr Case
    ######################################

    solr_case = realistic_activity_user.cases.find_or_create_by case_name: 'SOLR CASE'
    solr_try = solr_case.tries.latest
    solr_params = {
      field_spec:   'id:id, title:title',
      query_params: 'q=*:*',
    }
    solr_try.search_endpoint = tmdb_solr_endpoint
    solr_try.update solr_params
    print_case_info solr_case

    ######################################
    # ES Case
    ######################################

    es_case = realistic_activity_user.cases.find_or_create_by case_name: 'ES CASE'
    es_try = es_case.tries.latest
    es_params = {
      field_spec:   'id:_id, title:title',
      query_params: '{"query": {"match_all": {}}}',
    }
    es_try.search_endpoint = tmdb_es_endpoint
    es_try.update es_params
    print_case_info es_case

    ######################################
    # Search API Case
    ######################################

    searchapi_case = realistic_activity_user.cases.find_or_create_by case_name: 'SEARCHAPI CASE'
    searchapi_try = searchapi_case.tries.latest
    searchapi_params = {
      field_spec:   'id:id, title:title, url',
      query_params: 'q=#$query##',
    }
    searchapi_try.search_endpoint = search_api_endpoint
    searchapi_try.update searchapi_params

    searchapi_case.queries.create(query_text: 'student accomodation')
    print_case_info searchapi_case

    ######################################
    # Static Case
    ######################################

    static_case = realistic_activity_user.cases.find_or_create_by case_name: 'STATIC CASE'
    static_try = static_case.tries.latest
    static_try.search_endpoint = static_endpoint
    static_try.update field_spec: 'id:id, title:title, thumb:image_url', query_params: 'q=#$query##'

    duck_query_text = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Bucephala-albeola-010.jpg/250px-Bucephala-albeola-010.jpg'
    static_case.queries.find_or_create_by(query_text: duck_query_text)

    if static_case.snapshots.none?
      snapshot = static_case.snapshots.create(name: 'Duck and Swan Results')
      duck_docs = {
        duck_query_text => {
          docs: [
            { id: 'bufflehead-001',     position: 1,  fields: { title: 'Bufflehead Duck', image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Drake_Bufflehead_LBI_%28cropped%29.png/330px-Drake_Bufflehead_LBI_%28cropped%29.png' } },
            { id: 'mallard-001',        position: 2,  fields: { title: 'Mallard Duck',         image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Anas_platyrhynchos_male_female_quadrat.jpg/330px-Anas_platyrhynchos_male_female_quadrat.jpg' } },
            { id: 'mandarin-001',       position: 3,  fields: { title: 'Mandarin Duck',        image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Mandarin_duck_%28Aix_galericulata%29.jpg/330px-Mandarin_duck_%28Aix_galericulata%29.jpg' } },
            { id: 'wood-duck-001',      position: 4,  fields: { title: 'Wood Duck',            image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Wood_Duck_Wissahickon_Creek.png/330px-Wood_Duck_Wissahickon_Creek.png' } },
            { id: 'teal-001',           position: 5,  fields: { title: 'Green-winged Teal',    image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Green-winged_Teal%2C_Port_Aransas%2C_Texas.jpg/330px-Green-winged_Teal%2C_Port_Aransas%2C_Texas.jpg' } },
            { id: 'mute-swan-001',      position: 6,  fields: { title: 'Mute Swan',            image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/CygneVaires.jpg/330px-CygneVaires.jpg' } },
            { id: 'whooper-swan-001',   position: 7,  fields: { title: 'Whooper Swan',         image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Cygnus_cygnus_Singschwan.jpg/330px-Cygnus_cygnus_Singschwan.jpg' } },
            { id: 'trumpeter-swan-001', position: 8,  fields: { title: 'Trumpeter Swan',       image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Trumpeter_swans_in_winter.jpg/330px-Trumpeter_swans_in_winter.jpg' } },
            { id: 'eider-001',          position: 9,  fields: { title: 'Common Eider Duck',    image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/%D0%9F%D1%83%D1%85%D1%96%D0%B2%D0%BA%D0%B0_%D0%BD%D0%B0_%D0%9A%D1%96%D0%BD%D0%B1%D1%83%D1%80%D0%BD%D1%81%D1%8C%D0%BA%D0%B8%D0%B9_%D0%BA%D0%BE%D1%81%D1%96.jpg/330px-%D0%9F%D1%83%D1%85%D1%96%D0%B2%D0%BA%D0%B0_%D0%BD%D0%B0_%D0%9A%D1%96%D0%BD%D0%B1%D1%83%D1%80%D0%BD%D1%81%D1%8C%D0%BA%D0%B8%D0%B9_%D0%BA%D0%BE%D1%81%D1%96.jpg' } },
            { id: 'canvasback-001',     position: 10, fields: { title: 'Canvasback Duck',      image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Aythya_valisineria_at_Las_Gallinas_Wildlife_Ponds.jpg/330px-Aythya_valisineria_at_Las_Gallinas_Wildlife_Ponds.jpg' } }
          ],
        },
      }
      SnapshotManager.new(snapshot).import_queries(duck_docs)
    end

    static_endpoint.endpoint_url = "http://localhost:3000/api/cases/#{static_case.id}/snapshots/#{static_case.snapshots.first.id}/search"
    static_endpoint.save

    print_case_info static_case

    print_step 'End of seeding cases................'

    # Ratings
    print_step 'Seeding ratings................'

    tens_of_queries_case = realistic_activity_user.cases.find_or_create_by case_name: '10s of Queries', nightly: true

    docs_lookup = {}
    unless tens_of_queries_case.queries.count >= 20
      generator = ::RatingsGenerator.new search_url, { number: 20 }
      ratings   = generator.generate_ratings

      # Create lookup hash for document fields by query_text and doc_id
      generator.docs.each do |item|
        key = "#{item[:query_text]}|#{item[:doc_id]}"
        docs_lookup[key] = item[:doc]
      end

      options = { format: :hash }
      service = ::RatingsImporter.new tens_of_queries_case, ratings, options

      service.import

      print_step 'Seeded 10s of queries'
    end

    print_step 'End of seeding ratings................'

    # Tries
    print_step 'Seeding tries................'

    30.times do |counter|
      try_specifics = {
        try_number:   counter,
        query_params: 'q=#$query##' + "&magicBoost=#{counter + 2}",
      }

      try_params = try_defaults.merge(try_specifics)

      new_try = tens_of_queries_case.tries.build try_params

      try_number = tens_of_queries_case.last_try_number + 1

      new_try.try_number = try_number
      tens_of_queries_case.last_try_number = try_number

      new_try.save

      score_specifics = {
        user:       realistic_activity_user,
        try:        new_try,
        score:      (0.01 * counter),
        scorer:     tens_of_queries_case.scorer,
        created_at: DateTime.now - (30 - counter).days,
        updated_at: DateTime.now - (30 - counter).days,
      }
      new_case_score = tens_of_queries_case.scores.build(score_specifics)
      new_case_score.save

      tens_of_queries_case.save

      # seventy percent of the time lets grab a new origin for the try in the tree
      # 30 percent of the time we just add a new one
      parent_try = tens_of_queries_case.tries.sample if rand(0..100) <= 70
      new_try.parent = parent_try

      new_try.save
    end

    print_step 'End of seeding tries................'

    # Teams
    print_step 'Seeding teams................'

    ######################################
    # OSC Team
    ######################################

    osc = ::Team.where(name: 'OSC').first_or_create
    osc.members << osc_owner_user unless osc.members.include?(osc_owner_user)
    osc.members << osc_member_user unless osc.members.include?(osc_member_user)
    osc.members << realistic_activity_user unless osc.members.include?(realistic_activity_user)
    osc.members << osc_ai_judge unless osc.members.include?(osc_ai_judge)
    osc.members << azure_openai_judge unless osc.members.include?(azure_openai_judge)
    osc.members << azure_anthropic_judge unless osc.members.include?(azure_anthropic_judge)
    osc.cases << tens_of_queries_case unless osc.members.include?(tens_of_queries_case)
    osc.search_endpoints << statedecoded_solr_endpoint unless osc.search_endpoints.include?(statedecoded_solr_endpoint)
    print_step 'End of seeding teams................'

    # Books
    print_step 'Seeding books................'

    book = ::Book.where(name: 'Book of Ratings').first_or_create

    book.scale = Scorer.system_default_scorer.scale
    book.scale_with_labels = Scorer.system_default_scorer.scale_with_labels

    book.teams << osc
    book.ai_judges << osc_ai_judge
    book.ai_judges << azure_openai_judge
    book.ai_judges << azure_anthropic_judge
    book.save

    # this code copied from populate_controller.rb and should be in a service...
    # has a hacked in judgement creator...
    tens_of_queries_case.queries.each do |query|
      query.ratings.each_with_index do |rating, index|
        query_doc_pair = book.query_doc_pairs.find_or_create_by query_text: query.query_text,
                                                                doc_id:     rating.doc_id,
                                                                position:   index

        # Populate document_fields from the docs lookup
        lookup_key = "#{query.query_text}|#{rating.doc_id}"
        query_doc_pair.document_fields = docs_lookup[lookup_key].except('id') if docs_lookup[lookup_key]

        query_doc_pair.judgements << Judgement.new(rating: rating.rating, user: osc_member_user)
        query_doc_pair.save
      end

      book.reload
      book.query_doc_pairs.sample(3).each do |query_doc_pair|
        query_doc_pair.judgements << Judgement.new(rating: query_doc_pair.judgements.first.rating,
                                                   user:   realistic_activity_user)
        query_doc_pair.save
      end
    end

    # Multiple Cases
    print_step 'Seeding multiple cases................'
    case_names = [ 'Typeahead: Dairy', 'Typeahead: Meats', 'Typeahead: Dessert' ]

    case_names.each do |case_name|
      # check if we've already created the case
      break if realistic_activity_user.cases.exists?(case_name: case_name)

      kase = realistic_activity_user.cases.create case_name: case_name

      kase.queries.create(query_text: case_name.split(':').last.strip.downcase)

      days_of_experimentation = rand(3..20) # somewhere between

      days_of_experimentation.times do |counter|
        try_specifics = {
          try_number:   counter,
          query_params: 'q=#$query##' + "&magicBoost=#{counter + 2}",
        }

        try_params = try_defaults.merge(try_specifics)

        new_try = kase.tries.build try_params

        try_number = kase.last_try_number + 1

        new_try.try_number   = try_number
        kase.last_try_number = try_number

        new_try.save

        score_specifics = {
          user:       realistic_activity_user,
          try:        new_try,
          score:      (0.01 * counter),
          scorer:     kase.scorer,
          created_at: DateTime.now - (days_of_experimentation - counter).days,
          updated_at: DateTime.now - (days_of_experimentation - counter).days,
        }
        new_case_score = kase.scores.build(score_specifics)
        new_case_score.save

        kase.save

        # seventy percent of the time lets grab a new origin for the try in the tree
        # 30 percent of the time we just add a new one
        parent_try = kase.tries.sample if rand(0..100) <= 70
        new_try.parent = parent_try

        new_try.save
      end
    end

    print_step 'End of multiple cases................'
    print_step ''
    print_step 'Run `bin/docker s` and browse to http://localhost:3000. Log in with quepid+realisticactivity@o19s.com / password.'
  end

  desc 'large_data', 'load the very large sample data'
  long_desc <<-LONGDESC
  `large_data`

  EXAMPLES:

  $ thor large_data
  LONGDESC
  def large_data
    load_environment

    print_step 'Seeding large cases...............'

    ######################################
    # Defaults
    ######################################

    search_url = 'http://quepid-solr.dev.o19s.com:8985/solr/statedecoded/select'

    user_defaults = user_default_params

    try_defaults = try_default_params

    statedecoded_solr_endpoint = ::SearchEndpoint.find_or_create_by search_engine: :solr,
                                                                    endpoint_url: 'http://quepid-solr.dev.o19s.com:8985/solr/statedecoded/select', api_method: 'JSONP'

    ######################################
    # User with 100s of Queries
    ######################################

    user_specifics = {
      name:          'User with 100s of Queries',
      email:         'quepid+100sOfQueries@o19s.com',
      administrator: true,
    }
    user_params = user_defaults.merge(user_specifics)
    hundreds_of_queries_user = seed_user user_params
    print_user_info user_params

    ######################################
    # User with 1000s of Queries
    ######################################

    user_specifics = {
      name:          'User with 1000s of Queries',
      email:         'quepid+1000sOfQueries@o19s.com',
      administrator: true,
    }
    user_params = user_defaults.merge(user_specifics)
    thousands_of_queries_user = seed_user user_params
    print_user_info user_params

    osc = ::Team.where(name: 'OSC').first_or_create
    osc.members << hundreds_of_queries_user
    osc.members << thousands_of_queries_user

    osc.search_endpoints << statedecoded_solr_endpoint
    osc.save!

    hundreds_of_queries_case = hundreds_of_queries_user.cases.create case_name: '100s of Queries'
    solr_try = hundreds_of_queries_case.tries.latest
    solr_try.update try_defaults
    solr_try.search_endpoint = statedecoded_solr_endpoint

    # was 200
    unless hundreds_of_queries_case.queries.count > 400
      generator = ::RatingsGenerator.new search_url, { number: 400, show_progress: true }
      ratings   = generator.generate_ratings

      options = { format: :hash, show_progress: true }
      service = ::RatingsImporter.new hundreds_of_queries_case, ratings, options

      service.import

      print_step 'Seeded 100s of queries'
    end

    thousands_of_queries_case = thousands_of_queries_user.cases.create case_name: '1000s of Queries'
    solr_try = thousands_of_queries_case.tries.latest
    solr_try.update try_defaults
    solr_try.search_endpoint = statedecoded_solr_endpoint

    unless thousands_of_queries_case.queries.count > 5000
      generator = ::RatingsGenerator.new search_url, { number: 5000, show_progress: true }
      ratings   = generator.generate_ratings

      options = { format: :hash, show_progress: true }
      service = ::RatingsImporter.new thousands_of_queries_case, ratings, options

      service.import

      print_step 'Seeded 1000s of queries'
    end
  end

  desc 'haystack_party', 'load the haystack rating party data'
  long_desc <<-LONGDESC
  `haystack_party`

  EXAMPLES:

  $ thor haystack_party
  LONGDESC
  def haystack_party
    load_environment

    contents = unzip_file_in_memory(Rails.root.join('db/sample_data/haystack_rating_party_case.json.zip'))
    data = JSON.parse(contents)
    case_params = data.to_h.deep_symbolize_keys

    realistic_activity_user = ::User.find_by(email: 'quepid+realisticActivity@o19s.com')

    @case = ::Case.find_by(id: 6789)
    @case&.destroy

    @case = ::Case.new(id: 6789)
    options = { force_create_users: true }
    case_importer = ::CaseImporter.new @case, realistic_activity_user, case_params, options

    case_importer.validate
    case_importer.import

    print_step 'About to import book........'
    contents = unzip_file_in_memory(Rails.root.join('db/sample_data/haystack_rating_party_book.json.zip'))
    data = JSON.parse(contents)
    book_params = data.to_h.deep_symbolize_keys

    @book = ::Book.find_by(id: 25)
    @book&.really_destroy
    @book = ::Book.new(id: 25)
    options = { force_create_users: true }
    book_importer = ::BookImporter.new @book, realistic_activity_user, book_params, options

    book_importer.validate
    book_importer.import

    osc = ::Team.find_by(name: 'OSC')

    @case.book = @book
    @case.teams << osc
    @book.teams << osc
    @case.save
    @book.save

    @case.snapshots.each do |snapshot|
      print_step "Delete #{snapshot.id}"
      snapshot.destroy!
    end

    snapshot_files = [ 'haystack_rating_party_snapshot_no-vector.json.zip',
                       'haystack_rating_party_snapshot_vector-2.json.zip',
                       'haystack_rating_party_snapshot_with-vector.json.zip' ]

    snapshot_files.each do |snapshot_file|
      print_step "Processing #{snapshot_file}"
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
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/PerceivedComplexity

  private

  def seed_user hash
    if hash[:email] && ::User.exists?(email: hash[:email].downcase)
      ::User.where(email: hash[:email].downcase).first
    elsif hash[:name] && ::User.exists?(name: hash[:name])
      ::User.where(name: hash[:name]).first
    else
      ::User.create hash
    end
  end

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

  def print_step text
    puts text.blue
  end

  def print_user_info info
    print_step "Seeded user: email: #{info[:email]}, password: #{info[:password]}"
  end

  def print_case_info the_case
    print_step "Seeded case: name: #{the_case.case_name}, ID: #{the_case.id} for: #{the_case.owner.email}"
  end

  def user_default_params
    user_defaults = {
      administrator:         false,
      agreed:                true,
      agreed_time:           Time.zone.now,
      completed_case_wizard: true,
      name:                  'No Name',
      password:              'password',
      email:                 'foo@example.com',
    }
    user_defaults
  end

  def try_default_params
    statedecoded_solr_endpoint = ::SearchEndpoint.find_or_create_by search_engine: :solr,
                                                                    endpoint_url:  'http://quepid-solr.dev.o19s.com:8985/solr/statedecoded/select',
                                                                    api_method:    'JSONP'

    {
      try_number:         '1',
      query_params:       'q=#$query##',
      field_spec:         'id:id title:catch_line structure text',
      search_endpoint_id: statedecoded_solr_endpoint.id,

    }
  end
end
# rubocop:enable Style/StringConcatenation
