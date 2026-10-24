# frozen_string_literal: true

module TextSearch
  extend ActiveSupport::Concern

  included do
    scope :search_by, lambda { |term, *columns|
      pattern = "%#{sanitize_sql_like(term.to_s.downcase)}%"
      predicates = columns.map do |column|
        table, name = column.to_s.split('.', 2)
        unless name
          name = table
          table = table_name
        end
        Arel::Table.new(table)[name].lower.matches(pattern, '\\', true)
      end
      where(predicates.reduce(&:or))
    }
  end
end
