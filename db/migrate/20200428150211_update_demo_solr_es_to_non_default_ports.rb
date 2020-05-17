class UpdateDemoSolrEsToNonDefaultPorts < ActiveRecord::Migration
  # Our demo Solr and ES instances were getting drive by vandalism by running on
  # default ports on the Internet.  So we moved to non defaults.  Update existing
  # cases.  https://github.com/o19s/quepid/issues/104
  def change

    solrTries = Try.where("search_url like '%quepid-solr.dev.o19s.com:8983/solr%'")
    solrTries.each do |try|
      try.search_url.sub!("8983","8985") # the new default demo port.
      try.save!
    end

    esTries = Try.where("search_url like '%quepid-elasticsearch.dev.o19s.com:9200%'")
    esTries.each do |try|
      try.search_url.sub!("9200","9206") # the new default demo port.
      try.save!
    end
  end
end
