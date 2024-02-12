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

# Search Endpoints
print_step "Seeding search endpoints................"

statedecoded_solr_endpoint = SearchEndpoint.find_or_create_by search_engine: :solr, endpoint_url:   "http://quepid-solr.dev.o19s.com:8985/solr/statedecoded/select", api_method: 'JSONP'
tmdb_solr_endpoint = SearchEndpoint.find_or_create_by name:"TMDB Solr", search_engine: :solr, endpoint_url: "http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select", api_method: 'JSONP'

tmdb_es_endpoint = SearchEndpoint.find_or_create_by   search_engine: :es, endpoint_url:   "http://quepid-elasticsearch.dev.o19s.com:9206/tmdb/_search", api_method: 'POST'

print_step "End of seeding search endpoints................"

# Users
print_step "Seeding users................"

######################################
# Defaults
######################################

search_url = "http://quepid-solr.dev.o19s.com:8985/solr/statedecoded/select"

user_defaults = {
  administrator:    false,
  agreed:           true,
  agreed_time:      Time.now,
  completed_case_wizard:       true,
  name:             'No Name',
  password:         'password',
  email:            'foo@example.com',
}

try_defaults = {
  try_number:       '1',
  query_params:     'q=#$query##',
  field_spec:       'id:id title:catch_line structure text',
  search_endpoint_id: statedecoded_solr_endpoint.id

}

######################################
# Admin User
######################################

user_specifics = {
  administrator:    true,
  name:             'Admin User',
  email:            'quepid+admin@o19s.com',
}
user_params = user_defaults.merge(user_specifics)
admin_user  = seed_user user_params
print_user_info user_params

######################################
# User with ES Case
######################################

user_specifics = {
  name:             'User with ES Case',
  email:            'quepid+es@o19s.com',
}
user_params  = user_defaults.merge(user_specifics)
es_case_user = seed_user user_params
print_user_info user_params

######################################
# User with Realistic Activity in Quepid
######################################

user_specifics = {
  name:             'User with Realistic Activity in Quepid',
  email:            'quepid+realisticActivity@o19s.com',
}
user_params          = user_defaults.merge(user_specifics)
realistic_activity_user = seed_user user_params
print_user_info user_params

# go ahead and assign the end point to this person.
statedecoded_solr_endpoint.owner = realistic_activity_user
tmdb_solr_endpoint.owner = realistic_activity_user
tmdb_es_endpoint.owner = realistic_activity_user

statedecoded_solr_endpoint.save
tmdb_solr_endpoint.save
tmdb_es_endpoint.save

######################################
# OSC Team Owner
######################################

user_specifics = {
  name:             'OSC Team Owner',
  email:            'quepid+oscOwner@o19s.com',
}
user_params    = user_defaults.merge(user_specifics)
osc_owner_user = seed_user user_params
print_user_info user_params

######################################
# OSC Team Member
######################################

user_specifics = {
  name:             'OSC Team Member',
  email:            'quepid+oscMember@o19s.com'
}
user_params     = user_defaults.merge(user_specifics)
osc_member_user = seed_user user_params
print_user_info user_params

print_step "End of seeding users................"

# Cases
print_step "Seeding cases................"

def print_case_info the_case
  print_step "Seeded case: name: #{the_case.case_name}, ID: #{the_case.id} for: #{the_case.owner.email}"
end

######################################
# Solr Case
######################################

solr_case = realistic_activity_user.cases.create case_name: 'SOLR CASE'
solr_try = solr_case.tries.latest
solr_params = {
  field_spec:   "id:id, title:title",
  query_params: 'q=*:*'
}
solr_try.search_endpoint = tmdb_solr_endpoint
solr_try.update solr_params
print_case_info solr_case

######################################
# ES Case
######################################

es_case = realistic_activity_user.cases.create case_name: 'ES CASE'
es_try = es_case.tries.latest
es_params = {
  field_spec:   "id:_id, title:title",
  query_params: '{"query": {"match_all": {}}}'
}
es_try.search_endpoint = tmdb_es_endpoint
es_try.update es_params
print_case_info es_case

print_step "End of seeding cases................"

# Ratings
print_step "Seeding ratings................"



tens_of_queries_case = realistic_activity_user.cases.create case_name: '10s of Queries'

unless tens_of_queries_case.queries.count >= 20
  generator = RatingsGenerator.new search_url, { number: 20 }
  ratings   = generator.generate_ratings

  options    = { format: :hash }
  service = ::RatingsImporter.new tens_of_queries_case, ratings, options

  service.import

  print_step "Seeded 10s of queries"
end

print_step "End of seeding ratings................"

# Tries
print_step "Seeding tries................"

30.times do |counter|

  try_specifics = {
    try_number:       counter,
    query_params:     'q=#$query##&magicBoost=' + (counter+2).to_s    
  }

  try_params = try_defaults.merge(try_specifics)

  new_try = tens_of_queries_case.tries.build try_params

  try_number = tens_of_queries_case.last_try_number + 1

  new_try.try_number   = try_number
  tens_of_queries_case.last_try_number = try_number

  new_try.save
  
  score_specifics = {
    user: realistic_activity_user,
    try: new_try, 
    score: (0.01 * counter),
    created_at: DateTime.now - (30 - counter).days,
    updated_at: DateTime.now - (30 - counter).days
  }
  new_case_score = tens_of_queries_case.scores.build (score_specifics)
  new_case_score.save
  
  tens_of_queries_case.save

  # seventy percent of the time lets grab a new origin for the try in the tree
  # 30 percent of the time we just add a new one
  if rand(0..100) <= 70
    parent_try = tens_of_queries_case.tries.sample
  end
  new_try.parent = parent_try

  new_try.save


end


print_step "End of seeding tries................"

# Teams
print_step "Seeding teams................"

######################################
# OSC Team
######################################

osc = Team.where(owner_id: osc_owner_user.id, name: 'OSC').first_or_create
osc.members << osc_member_user unless osc.members.include?(osc_member_user)
osc.members << realistic_activity_user unless osc.members.include?(realistic_activity_user)
osc.cases << tens_of_queries_case unless osc.members.include?(tens_of_queries_case)
print_step "End of seeding teams................"

# Books
print_step "Seeding books................"

book = Book.where(name: "Book of Ratings", scorer: Scorer.system_default_scorer, selection_strategy: SelectionStrategy.find_by(name:'Multiple Raters')).first_or_create
book.teams << osc
book.save

# this code copied from populate_controller.rb and should be in a service...
# has a hacked in judgement creator...
tens_of_queries_case.queries.each do |query|
  query.ratings.each_with_index do |rating, index|
    query_doc_pair = book.query_doc_pairs.find_or_create_by query_text: query.query_text,
                                                           doc_id:     rating.doc_id,
                                                           position: index
    query_doc_pair.judgements << Judgement.new(rating: rating.rating, user: osc_member_user)
    query_doc_pair.save
  end
  
  book.reload
  book.query_doc_pairs.shuffle[0..2].each do |query_doc_pair|
    query_doc_pair.judgements << Judgement.new(rating: query_doc_pair.judgements.first.rating, user: realistic_activity_user)
    query_doc_pair.save
  end

end

# Multiple Cases
print_step "Seeding multiple cases................"
case_names = ["Typeahead: Dairy", "Typeahead: Meats", "Typeahead: Dessert", "Typeahead: Fruit & Veg"]

case_names.each do |case_name|
  # check if we've already created the case
  if realistic_activity_user.cases.exists?(case_name: case_name)
    break
  end
  kase = realistic_activity_user.cases.create case_name: case_name
  
  days_of_experimentation = rand(3..20) # somewhere between 
  
  days_of_experimentation.times do |counter|
  
    try_specifics = {
      try_number:       counter,
      query_params:     'q=#$query##&magicBoost=' + (counter+2).to_s
    }
  
    try_params = try_defaults.merge(try_specifics)
  
    new_try = kase.tries.build try_params
  
  
    try_number = kase.last_try_number + 1
  
    new_try.try_number   = try_number
    kase.last_try_number = try_number
  
    new_try.save
    
    score_specifics = {
      user: realistic_activity_user,
      try: new_try, 
      score: (0.01 * counter),
      created_at: DateTime.now - (days_of_experimentation - counter).days,
      updated_at: DateTime.now - (days_of_experimentation - counter).days
    }
    new_case_score = kase.scores.build (score_specifics)
    new_case_score.save
    
    kase.save
  
    # seventy percent of the time lets grab a new origin for the try in the tree
    # 30 percent of the time we just add a new one
    if rand(0..100) <= 70
      parent_try = kase.tries.sample
    end
    new_try.parent = parent_try
  
    new_try.save
  
  
  end
  

end

print_step "End of multiple cases................"

print_step "Loading Haystack Rating Party sample data........."

contents = unzip_file_in_memory(Rails.root.join('db', 'sample_data', 'haystack_rating_party_case.json.zip'))
data = JSON.parse(contents)
case_params = data.to_h.deep_symbolize_keys

@case = Case.new(id: 6789)
options = { force_create_users: true }
case_importer = ::CaseImporter.new @case,realistic_activity_user, case_params, options

case_importer.validate
case_importer.import

print_step "About to import book........"
contents = unzip_file_in_memory(Rails.root.join('db', 'sample_data', 'haystack_rating_party_book.json.zip'))
data = JSON.parse(contents)
book_params = data.to_h.deep_symbolize_keys


@book = Book.new(id: 25)
options = { force_create_users: true }
book_importer = ::BookImporter.new @book,realistic_activity_user, book_params, options

#book_importer.validate
#book_importer.import

@case.book = @book
@case.teams << osc
@book.teams << osc
@case.save
@book.save

contents = unzip_file_in_memory(Rails.root.join('db', 'sample_data', 'haystack_rating_party_snapshot_no-vector.json.zip'))
data = JSON.parse(contents)
snapshot_params = data.to_h.deep_symbolize_keys

@snapshot = Snapshot.new
#@snapshot.id = data[:id]
#@snapshot.name = data[:name]
#@snapshot.case = @case

#data[:queries].each do |query|


print_step "About to import snapshot................"

params = {
  name:       snapshot_params[:name],
  created_at: snapshot_params[:created_at],
}

snapshot = @case.snapshots.create params

service = SnapshotManager.new(snapshot)

snapshot_docs = snapshot_params[:docs]
snapshot_queries = snapshot_params[:queries]

service.add_docs snapshot_docs, snapshot_queries


# service = SnapshotManager.new(snapshot)

# queries = {}
# snapshot_params[:queries].each do |q|
#   docs = []
#   q[:ratings].each_with_index do |r, index|
#     docs << {id: r.key, explain: nil, position: index }
#   end
  
#   queries[q[:query_text]] ||= { docs: docs }
  
# end


# service.import_queries queries






print_step "End of Haystack Rating Party sample data................"

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
