# frozen_string_literal: true

module Analytics
  module RatingsHelper
    def format_variance variance
      variance = variance.to_f
      if (variance >= 0.0) && (variance < 0.25)
        colour = 'SeaGreen'
      elsif (variance >= 0.25) && (variance <= 0.5)
        colour = '#dbab09'
      elsif (variance > 0.5) && (variance <= 1.0)
        colour = 'Tomato'
      end
      colour
    end
  end
end
