require 'zip'

def seed_user hash
  if User.where(email: hash[:email].downcase).exists?
    User.where(email: hash[:email].downcase).first
  else
    User.create hash
  end
end

def print_step text
  puts text.blue
end

def print_user_info info
  print_step "Seeded user: email: #{info[:email]}, password: #{info[:password]}"
end

def unzip_file_in_memory(zip_file)
  Zip::File.open(zip_file) do |zip|
    entry = zip.first
    entry.get_input_stream.read  
  end
end



# Big Cases

if ENV['SEED_LARGE_CASES']
  print_step "Seeding large cases..............."
  ######################################
  # User with 100s of Queries
  ######################################

  user_specifics = {
    name:             'User with 100s of Queries',
    email:            'quepid+100sOfQueries@o19s.com',
  }
  user_params = user_defaults.merge(user_specifics)
  hundreds_of_queries_user = seed_user user_params
  print_user_info user_params

  ######################################
  # User with 1000s of Queries
  ######################################

  user_specifics = {
    name:             'User with 1000s of Queries',
    email:            'quepid+1000sOfQueries@o19s.com',
  }
  user_params = user_defaults.merge(user_specifics)
  thousands_of_queries_user = seed_user user_params
  print_user_info user_params
  
  hundreds_of_queries_case = hundreds_of_queries_user.cases.create case_name: '100s of Queries'
  solr_try = hundreds_of_queries_case.tries.latest
  solr_try.update try_defaults
  solr_try.search_endpoint = statedecoded_solr_endpoint


  # was 200
  unless hundreds_of_queries_case.queries.count >= 400
    generator = RatingsGenerator.new search_url, { number: 400, show_progress: true }
    ratings   = generator.generate_ratings

    options    = { format: :hash, show_progress: true }
    service = ::RatingsImporter.new hundreds_of_queries_case, ratings, options

    service.import

    print_step "Seeded 100s of queries"
  end

  thousands_of_queries_case = thousands_of_queries_user.cases.create case_name: '1000s of Queries'
  solr_try = thousands_of_queries_case.tries.latest
  solr_try.update try_defaults
  solr_try.search_endpoint = statedecoded_solr_endpoint

  unless thousands_of_queries_case.queries.count >= 5000
    generator = RatingsGenerator.new search_url, { number: 5000, show_progress: true }
    ratings   = generator.generate_ratings

    options    = { format: :hash, show_progress: true }
    service = ::RatingsImporter.new thousands_of_queries_case, ratings, options

    service.import

    print_step "Seeded 1000s of queries"
  end
end
