class FixQueryDocPairsDocumentFieldsType < ActiveRecord::Migration[7.1]
  def change    
    execute "ALTER TABLE query_doc_pairs MODIFY document_fields mediumtext CHARACTER SET utf8mb4"  
  end

end
