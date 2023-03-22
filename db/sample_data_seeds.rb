

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
  search_url:       search_url,
  search_engine:    'solr',
  field_spec:       'id:id title:catch_line structure text',

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
# One Case User
######################################

user_specifics = {
  name:             'One Case User',
  email:            'quepid+1case@o19s.com',
}
user_params   = user_defaults.merge(user_specifics)
one_case_user = seed_user user_params
print_user_info user_params

######################################
# Two Case User
######################################

user_specifics = {
  name:             'Two Case User',
  email:            'quepid+2case@o19s.com',
}
user_params   = user_defaults.merge(user_specifics)
two_case_user = seed_user user_params
print_user_info user_params

######################################
# User with Solr Case
######################################

user_specifics = {
  name:             'User with Solr Case',
  email:            'quepid+solr@o19s.com',
}
user_params    = user_defaults.merge(user_specifics)
solr_case_user = seed_user user_params
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

######################################
# User with Custom Scorer
######################################
user_specifics = {
  name:             'User with Custom Scorer',
  email:            'quepid+CustomScorer@o19s.com',
}
user_params = user_defaults.merge(user_specifics)
custom_scorer_user = seed_user user_params
print_user_info user_params

######################################
# User with Custom Scorer as Default
######################################

user_specifics = {
  name:             'User with Custom Scorer as Default',
  email:            'quepid+CustomScorerDefault@o19s.com',
}
user_params = user_defaults.merge(user_specifics)
custom_scorer_as_default_user = seed_user user_params
print_user_info user_params

print_step "End of seeding users................"

# Cases
print_step "Seeding cases................"

def print_case_info the_case
  print_step "Seeded case: name: #{the_case.case_name}, ID: #{the_case.id} for: #{the_case.owner.email}"
end

unless two_case_user.cases.count == 2
  first_case = two_case_user.cases.create case_name: 'First Case'
  print_case_info first_case
  second_case = two_case_user.cases.create case_name: 'Second Case'
  print_case_info second_case
end

######################################
# Solr Case
######################################

solr_case = solr_case_user.cases.create case_name: 'SOLR CASE'
solr_try = solr_case.tries.latest
solr_params = {
  search_engine: :solr,
  search_url:   "http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select",
  field_spec:   "id:id, title:title",
  query_params: 'q=*:*'
}
solr_try.update solr_params
print_case_info solr_case

######################################
# ES Case
######################################

es_case = es_case_user.cases.create case_name: 'ES CASE'
es_try = es_case.tries.latest
es_params = {
  search_engine: :es,
  search_url:   "http://quepid-elasticsearch.dev.o19s.com:9206/tmdb/_search",
  field_spec:   "id:_id, title:title",
  query_params: '{"query": {"match_all": {}}}'
}
es_try.update es_params
print_case_info es_case

print_step "End of seeding cases................"

# Scorers
print_step "Seeding scorers................"

######################################
# Custom Scorers
######################################

unless custom_scorer_user.owned_scorers.count == 3
  3.times do |i|
    scorer_params = {
      name:   "Custom Scorer #{i}",
      scale:  [1, 2, 3, 4],
      code:   'setScore(100);'
    }
    custom_scorer = custom_scorer_user.owned_scorers.create scorer_params
  end
end

######################################
# Custom Default Scorer
######################################

unless custom_scorer_as_default_user.default_scorer != Scorer.system_default_scorer
  scorer_params = {
    name:   "Custom Default Scorer",
    scale:  [1, 2, 3, 4],
    code:   'setScore(100);'
  }
  custom_scorer = custom_scorer_as_default_user.owned_scorers.create scorer_params
  custom_scorer_as_default_user.update default_scorer_id: custom_scorer.id
end

print_step "End of seeding scorers................"

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
osc.members << osc_member_user
osc.members << realistic_activity_user
osc.cases << tens_of_queries_case
print_step "End of seeding teams................"

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

  # was 200
  unless hundreds_of_queries_case.queries.count >= 400
    generator = RatingsGenerator.new search_url, { number: 200, show_progress: true }
    ratings   = generator.generate_ratings

    options    = { format: :hash, show_progress: true }
    service = ::RatingsImporter.new hundreds_of_queries_case, ratings, options

    service.import

    print_step "Seeded 100s of queries"
  end

  thousands_of_queries_case = thousands_of_queries_user.cases.create case_name: '1000s of Queries'

  unless thousands_of_queries_case.queries.count >= 2000
    generator = RatingsGenerator.new search_url, { number: 2000, show_progress: true }
    ratings   = generator.generate_ratings

    options    = { format: :hash, show_progress: true }
    service = ::RatingsImporter.new thousands_of_queries_case, ratings, options

    service.import

    print_step "Seeded 1000s of queries"
  end
end
