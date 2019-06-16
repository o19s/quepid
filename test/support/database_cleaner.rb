# frozen_string_literal: true

DatabaseCleaner.strategy = :transaction

module MiniTest
  class Spec
    before :each do
      DatabaseCleaner.start
    end

    after :each do
      DatabaseCleaner.clean
    end
  end
end
