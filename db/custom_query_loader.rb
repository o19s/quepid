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

# seed user specifics

def seed_user hash
  if User.where(email: hash[:email].downcase).exists?
    User.where(email: hash[:email].downcase).first
  else
    User.create hash
  end
end

user_specifics = {
  name:             'Query Importer User',
  email:            'quepid+qimporter@o19s.com',
  password:         'quepid+qimporter',
}
user_params          = user_defaults.merge(user_specifics)
tens_of_queries_user = seed_user user_params

require 'csv'

if ENV['CUSTOM_QUERY']
    path = ENV['PATH']
    puts "Loading custom queries from path=" + path

    # Ratings
    puts "Seeding ratings................"

    search_url = "http://quepid-solr.dev.o19s.com:8985/solr/statedecoded/select"

    rails_db = "#{Rails.root}/db/data/"
    puts rails_db
    files_list = Dir[rails_db + "*"]
    puts "File list: " + files_list.join(', ')

    CSV.foreach(rails_db + path, :headers => true) do |row|
        query = row['keyword']
        tens_of_queries_case = tens_of_queries_user.cases.first
        tens_of_queries_case.update case_name: "'" + query[0..185] + "'"

        puts "Creating case: " + tens_of_queries_case.case_name

        opts    = {
          format:         :hash,
          force:          true,
          clear_existing: true,
        }

        # non-existent doc id: the point is to create a query in this case
        ratings = [
                { query_text: query,   doc_id: ' 720784-021190', rating: ' 5' }
              ]

        puts "Importing query: " + query

        ratings_importer = RatingsImporter.new tens_of_queries_case, ratings, opts
        ratings_importer.import
    end

    puts "Done loading queries"

end

