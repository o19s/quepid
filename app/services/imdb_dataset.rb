# frozen_string_literal: true

# Starter case for the IMDb datasets: movie searches to run against an index of the IMDb
# catalogue. IMDb ships no queries or judgements, so this is queries only, and the case has
# no search endpoint until the user points it at their own index.
class ImdbDataset
  CASE_NAME = 'IMDb movie searches'

  QUERIES = [
    'rambo',
    'star wars',
    'comedy',
    'funny movies',
    'sad movies',
    'war movies',
    'space adventure',
    'action hero',
    'romantic comedy',
    'tearjerker drama'
  ].freeze

  def initialize user
    @user = user
  end

  # Fills an existing case with the starter queries, or with a random sample of that many of them (in their
  # usual order). The name and scorer are the case's own already.
  def populate kase, sample: nil, **_options
    texts = sample ? QUERIES.each_index.to_a.sample(sample).sort.map { |index| QUERIES[index] } : QUERIES
    queries = texts.map { |text| kase.queries.create!(query_text: text) }
    Arrangement::List.normalize_in_order(queries).each(&:save!)
    kase
  end
end
