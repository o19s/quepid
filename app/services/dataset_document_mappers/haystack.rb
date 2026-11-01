# frozen_string_literal: true

module DatasetDocumentMappers
  # The Haystack Rating Party documents carry name, brand, title, thumb and, for some, product_type (what the
  # judgement book keeps as each pair's document fields). There is no description, price or rating in them.
  class Haystack < DatasetDocumentMapper
    title first_of(:title, :name)
    brand from(:brand)
    thumb from(:thumb)
    category from(:product_type)
  end
end
