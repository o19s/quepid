# frozen_string_literal: true

#DatabaseCleaner.strategy = :transaction

module MiniTest
  class Spec
    before :each do
      puts "DC.start"
#      DatabaseCleaner.start
    end

    after :each do
      puts "DC>end"
      #DatabaseCleaner.clean
    end
  end
end
