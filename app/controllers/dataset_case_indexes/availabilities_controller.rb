# frozen_string_literal: true

module DatasetCaseIndexes
  # Is an index of this name already on the search endpoint's service? Answers the review page's Check availability
  # button for endpoints that go through Quepid's proxy; for the others the browser asks the service itself. Only reads.
  class AvailabilitiesController < ApplicationController
    include DatasetCaseScoped

    def show
      name = params[:index_name].to_s.strip
      builder = DatasetIndex.builder_for(@endpoint)
      return answer('unsupported', "Quepid cannot check names on #{SearchEngine.label(@endpoint.search_engine)}.") unless DatasetIndex::Availability.supports?(@endpoint)
      return answer('invalid', "#{name.inspect} is not a name #{builder::LABEL} accepts for an index.") unless builder.valid_name?(name)

      taken = DatasetIndex::Availability.new(@endpoint).taken?(name)
      answer(taken ? 'taken' : 'free', taken ? "#{name} is already there on #{@endpoint.fullname}." : "#{name} is free.")
    rescue DatasetIndex::Error => e
      answer('unknown', e.message)
    end

    private

    def answer status, message
      render json: { status: status, message: message }
    end
  end
end
