# frozen_string_literal: true

module DatasetDocumentMappers
  # WANDS' product.csv: a name, a description, a product class and a category path ("Furniture / Bedroom Furniture / Beds"),
  # an average rating, and a features string that is not used. There is no brand, price or picture. A product with no
  # description or category simply has none.
  class Wands < DatasetDocumentMapper
    title from(:product_name)
    description from(:product_description)
    rating number(:average_rating)
    category compute('the levels of its `category hierarchy`, and its `product_class`', uses: [ :'category hierarchy', :product_class ]) { |doc|
      doc['category hierarchy'].to_s.split('/').map(&:strip) + [ doc['product_class'] ]
    }
  end
end
