require 'csv'

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

user_defaults = {
  administrator:    false,
  agreed:           true,
  agreed_time:      Time.now,
  first_login:       false,
  name:             'No Name',
  password:         'password',
  email:            'foo@example.com',
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
# User with 10s of Queries
######################################

user_specifics = {
  name:             'User with 10s of Queries',
  email:            'quepid+10sOfQueries@o19s.com',
}
user_params          = user_defaults.merge(user_specifics)
tens_of_queries_user = seed_user user_params
print_user_info user_params

######################################
# Trek Team Owner
######################################

user_specifics = {
  name:             'Kirk',
  email:            'kirk@starfleet.com',
}
user_params     = user_defaults.merge(user_specifics)
trek_owner_kirk = seed_user user_params
print_user_info user_params

######################################
# Trek Team Member
######################################

user_specifics = {
  name:             'Spock',
  email:            'spock@vulcans.org'
}
user_params       = user_defaults.merge(user_specifics)
trek_member_spock = seed_user user_params
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
  print_step "Seeded case: name: #{the_case.case_name}, ID: #{the_case.id} for: #{the_case.user.email}"
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
print_case_info solr_case

######################################
# ES Case
######################################

es_case = es_case_user.cases.create case_name: 'ES CASE'
es_try = es_case.tries.best
es_params = {
  search_engine: :es,
  search_url:   Try::DEFAULTS[:es][:search_url],
  field_spec:   Try::DEFAULTS[:es][:field_spec],
  query_params: Try::DEFAULTS[:es][:query_params],
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

search_url = "http://quepid-solr.dev.o19s.com:8985/solr/statedecoded/select"

tens_of_queries_case = tens_of_queries_user.cases.create case_name: '10s of Queries'

unless tens_of_queries_case.queries.count >= 20
  generator = RatingsGenerator.new search_url, { number: 20 }
  ratings   = generator.generate_ratings

  options    = { format: :hash }
  service = ::RatingsImporter.new tens_of_queries_case, ratings, options

  service.import

  print_step "Seeded 10s of queries"
end

print_step "End of seeding ratings................"

# Teams
print_step "Seeding teams................"

######################################
# Trek Team
######################################

trek = Team.where(owner_id: trek_owner_kirk.id, name: 'NCC-1701 Enterprise').first_or_create
trek.members << trek_member_spock

phasers_rule = trek_owner_kirk.cases.create case_name: 'Phasers Rule', scorer: Scorer.system_default_scorer
print_case_info phasers_rule

phasers_rule.tries.create try_number:1, query_params: 'q=#$query##', field_spec: 'id:id title:title overview thumb:poster_path vote_count', search_url: 'http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select', name: 'Seeded Try', search_engine: 'solr', number_of_rows: 10

trek.cases << phasers_rule

ratings = <<~RATINGS
query,docid,rating
star trek,26965,1
star trek,81899,1
star trek,416182,1
star trek,414260,1
star trek,451572,1
star trek,522055,1
star trek,573374,1
star trek,161334,1
star trek,464207,1
star trek,9755,0
star trek,140607,0
star trek,11,0
star trek,37165,0
star trek,330459,0
star trek,72190,0
star trek,181808,0
star trek,1893,0
star trek,1892,0
star trek,1895,0
star trek,1894,0
star trek,13475,3
star trek,332562,0
star trek,54138,3
star trek,188927,3
star trek,154,3
star trek,199,3
star trek,152,3
star trek,168,3
star trek,201,3
star trek,157,3
star trek,193,3
star trek,174,3
star trek,200,3
star trek,172,3
RATINGS

options = {}
ratings_importer = RatingsImporter.new phasers_rule, CSV.parse(ratings, headers: true), options
ratings_importer.import

phasers_rule.reload



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
