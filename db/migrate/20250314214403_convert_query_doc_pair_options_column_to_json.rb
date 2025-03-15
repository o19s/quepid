class ConvertQueryDocPairOptionsColumnToJson < ActiveRecord::Migration[8.0]
  def up
      # First, create a temporary column
      add_column :query_doc_pairs, :options_json, :json
  
      # Copy and convert data from the string column to JSON
      QueryDocPair.where.not(options: nil).find_each do |record|
        # Skip records with nil or empty options
        next if record.options.blank?
        
        begin
          # Parse the string as JSON
          json_data = JSON.parse(record.options)
          # Update the new column
          record.update_column(:options_json, json_data)
        rescue JSON::ParserError => e
          puts "Error parsing JSON for record ID #{record.id}: #{e.message}"
          # Handle invalid JSON - could set to empty hash or log for manual fixing
          record.update_column(:options_json, {})
        end
      end
  
      # Remove the old column
      remove_column :query_doc_pairs, :options
      
      # Rename the new column to the original name
      rename_column :query_doc_pairs, :options_json, :options
    end
  
    def down
      # If you need to revert, convert back to string
      add_column :queries, :options_string, :string
      
      QueryDocPair.where.not(options: nil).find_each do |record|
        next if record.options.nil?
        record.update_column(:options_string, record.options.to_json)
      end
      
      remove_column :query_doc_pairs, :options
      rename_column :query_doc_pairs, :options_string, :options
    end
end
