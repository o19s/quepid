# frozen_string_literal: true

module DatasetDocumentMappers
  # IMDb's title.basics.tsv and title.ratings.tsv, joined on tconst. They have no description, brand, price or picture.
  class Imdb < DatasetDocumentMapper
    null_values '\N'

    title first_of(:primaryTitle, :originalTitle)
    category split(:genres, ',')
    rating number(:averageRating)
  end
end
