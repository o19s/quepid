class ResetAllBookCacheCounters < ActiveRecord::Migration[8.0]
  def up
  
   Book.all.each do |book|
  
       Book.reset_counters(book.id, :query_doc_pairs)
  
       end
  
    end
  
    def down
  
       # no rollback needed
  
    end
end
