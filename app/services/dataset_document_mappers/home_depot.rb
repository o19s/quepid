# frozen_string_literal: true

module DatasetDocumentMappers
  # The Home Depot products, as HomeDepotDataset keeps them in the case's book: the title from train.csv, the description
  # from product_descriptions.csv and the brand from attributes.csv ("MFG Brand Name"). There is no price, picture or category.
  class HomeDepot < DatasetDocumentMapper
    title from(:product_title)
    description from(:product_description)
    brand from(:brand)
  end
end
