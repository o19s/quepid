# Users
puts "Seeding users................"

def seed_user hash
  if User.where(username: hash[:username].downcase).exists?
    User.where(username: hash[:username].downcase).first
  else
    User.create hash
  end
end

def print_user_info info
  puts "Seeded user: username: #{info[:username]}, password: #{info[:password]}"
end

######################################
# Defaults
######################################

user_defaults = {
  administrator:    false,
  agreed:           true,
  agreed_time:      Time.now,
  first_login:       false,
  name:             'No Name',
  password:         'password',
  username:         'foo',
}

######################################
# Admin User
######################################

user_specifics = {
  administrator:    true,
  name:             'Admin User',
  username:         'quepid+admin@o19s.com',
  password:         'quepid+admin',
}
user_params = user_defaults.merge(user_specifics)
admin_user  = seed_user user_params
print_user_info user_params

######################################
# One Case User
######################################

user_specifics = {
  name:             'One Case User',
  username:         'quepid+1case@o19s.com',
  password:         'quepid+1case',
}
user_params   = user_defaults.merge(user_specifics)
one_case_user = seed_user user_params
print_user_info user_params

######################################
# Two Case User
######################################

user_specifics = {
  name:             'Two Case User',
  username:         'quepid+2case@o19s.com',
  password:         'quepid+2case',
}
user_params   = user_defaults.merge(user_specifics)
two_case_user = seed_user user_params
print_user_info user_params

######################################
# User with Solr Case
######################################

user_specifics = {
  name:             'User with Solr Case',
  username:         'quepid+solr@o19s.com',
  password:         'quepid+solr',
}
user_params    = user_defaults.merge(user_specifics)
solr_case_user = seed_user user_params
print_user_info user_params

######################################
# User with ES Case
######################################

user_specifics = {
  name:             'User with ES Case',
  username:         'quepid+es@o19s.com',
  password:         'quepid+es',
}
user_params  = user_defaults.merge(user_specifics)
es_case_user = seed_user user_params
print_user_info user_params

######################################
# User with 10s of Queries
######################################

user_specifics = {
  name:             'User with 10s of Queries',
  username:         'quepid+10sOfQueries@o19s.com',
  password:         'quepid+10sOfQueries',
}
user_params          = user_defaults.merge(user_specifics)
tens_of_queries_user = seed_user user_params
print_user_info user_params

######################################
# OSC Team Owner
######################################

user_specifics = {
  name:             'OSC Team Owner',
  username:         'quepid+oscOwner@o19s.com',
  password:         'quepid+oscOwner',
}
user_params    = user_defaults.merge(user_specifics)
osc_owner_user = seed_user user_params
print_user_info user_params

######################################
# OSC Team Member
######################################

user_specifics = {
  name:             'OSC Team Member',
  username:         'quepid+oscMember@o19s.com',
  password:         'quepid+oscMember',
}
user_params     = user_defaults.merge(user_specifics)
osc_member_user = seed_user user_params
print_user_info user_params

######################################
# Enterprise Owner
######################################

user_specifics = {
  name:             'Enterprise Owner',
  username:         'quepid+enterpriseOwner@o19s.com',
  password:         'quepid+enterpriseOwner',
}
user_params          = user_defaults.merge(user_specifics)
enterprise_owner_user = seed_user user_params
print_user_info user_params

######################################
# Enterprise Member
######################################

user_specifics = {
  name:             'Enterprise Member',
  username:         'quepid+enterpriseMember@o19s.com',
  password:         'quepid+enterpriseMember',
}
user_params           = user_defaults.merge(user_specifics)
enterprise_member_user = seed_user user_params
print_user_info user_params

######################################
# User with Custom Scorer
######################################
user_specifics = {
  name:             'User with Custom Scorer',
  username:         'quepid+CustomScorer@o19s.com',
  password:         'quepid+CustomScorer',
}
user_params = user_defaults.merge(user_specifics)
custom_scorer_user = seed_user user_params
print_user_info user_params

######################################
# User with Custom Scorer as Default
######################################

user_specifics = {
  name:             'User with Custom Scorer as Default',
  username:         'quepid+CustomScorerDefault@o19s.com',
  password:         'quepid+CustomScorerDefault',
}
user_params = user_defaults.merge(user_specifics)
custom_scorer_as_default_user = seed_user user_params
print_user_info user_params

puts "End of seeding users................"

# Cases
puts "Seeding cases................"

def print_case_info the_case
  puts "Seeded case: name: #{the_case.case_name}, ID: #{the_case.id} for: #{the_case.user.username}"
end

unless two_case_user.cases.count == 2
  second_case = two_case_user.cases.create case_name: 'Second Case'
  print_case_info second_case
end

######################################
# Solr Case
######################################

solr_case = solr_case_user.cases.first
solr_case.update case_name: 'SOLR CASE'
print_case_info solr_case

######################################
# ES Case
######################################

es_case = es_case_user.cases.first
es_case.update case_name: 'ES CASE'
es_try = es_case.tries.best
es_params = {
  search_engine: :es,
  search_url:   Try::DEFAULTS[:es][:search_url],
  field_spec:   Try::DEFAULTS[:es][:field_spec],
  query_params: Try::DEFAULTS[:es][:query_params],
}
es_try.update es_params
print_case_info es_case

puts "End of seeding cases................"

# Scorers
puts "Seeding scorers................"

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

unless custom_scorer_as_default_user.scorer_id.present?
  scorer_params = {
    name:   "Custom Default Scorer",
    scale:  [1, 2, 3, 4],
    code:   'setScore(100);'
  }
  custom_scorer = custom_scorer_as_default_user.owned_scorers.create scorer_params
  custom_scorer_as_default_user.update scorer_id: custom_scorer.id
end

puts "End of seeding scorers................"

# Ratings
puts "Seeding ratings................"

search_url = "http://quepid-solr.dev.o19s.com/solr/statedecoded"

tens_of_queries_case = tens_of_queries_user.cases.first
tens_of_queries_case.update case_name: '10s of Queries'

unless tens_of_queries_case.queries.count >= 20
  generator = RatingsGenerator.new search_url, { number: 20 }
  ratings   = generator.generate_ratings

  opts    = { format: :hash }
  service = ::RatingsImporter.new tens_of_queries_case, ratings, opts

  service.import

  puts "Seeded 10s of queries"
end

puts "End of seeding ratings................"

# Teams
puts "Seeding teams................"

######################################
# OSC Team
######################################

osc = Team.where(owner_id: osc_owner_user.id, name: 'OSC').first_or_create
osc.members << osc_member_user
puts "End of seeding teams................"

# Big Cases

if ENV['SEED_LARGE_CASES']
  puts "Seeding large cases..............."
  ######################################
  # User with 100s of Queries
  ######################################

  user_specifics = {
    name:             'User with 100s of Queries',
    password:         'quepid+100sOfQueries',
    username:         'quepid+100sOfQueries@o19s.com',
  }
  user_params = user_defaults.merge(user_specifics)
  hundreds_of_queries_user = seed_user user_params
  print_user_info user_params

  ######################################
  # User with 1000s of Queries
  ######################################

  user_specifics = {
    name:             'User with 1000s of Queries',
    password:         'quepid+1000sOfQueries',
    username:         'quepid+1000sOfQueries@o19s.com',
  }
  user_params = user_defaults.merge(user_specifics)
  thousands_of_queries_user = seed_user user_params
  print_user_info user_params

  hundreds_of_queries_case = hundreds_of_queries_user.cases.first
  hundreds_of_queries_case.update case_name: '100s of Queries'

  unless hundreds_of_queries_case.queries.count >= 200
    generator = RatingsGenerator.new search_url, { number: 200 }
    ratings   = generator.generate_ratings

    opts    = { format: :hash }
    service = ::RatingsImporter.new hundreds_of_queries_case, ratings, opts

    service.import

    puts "Seeded 100s of queries"
  end

  thousands_of_queries_case = thousands_of_queries_user.cases.first
  thousands_of_queries_case.update case_name: '1000s of Queries'

  unless thousands_of_queries_case.queries.count >= 2000
    generator = RatingsGenerator.new search_url, { number: 2000 }
    ratings   = generator.generate_ratings

    opts    = { format: :hash }
    service = ::RatingsImporter.new thousands_of_queries_case, ratings, opts

    service.import

    puts "Seeded 1000s of queries"
  end
end
