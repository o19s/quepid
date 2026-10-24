# frozen_string_literal: true

# LTR judgement lines: "<rating> qid:<query id> # <doc id> <query text>", one per rated doc.
module LtrExport
  def self.generate_for_case kase
    kase.queries.sort_by(&:id).flat_map do |query|
      query.ratings.fully_rated.map do |rating|
        "#{rating.rating} qid:#{query.id} # #{rating.doc_id} #{query.query_text}\n"
      end
    end.join
  end
end
