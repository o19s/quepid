# frozen_string_literal: true

# Base of the MCP write tools. Every lookup goes through the same
# *_involved_with scopes as the REST API, so a tool can only touch what the
# token's owner could touch in Quepid.
class QuepidToolset < RorMcp::Toolset
  abstract!

  private

  def current_user
    user = context.is_a?(Hash) ? context[:user] : nil
    raise 'Not authenticated' if user.nil?

    user
  end

  def find_case case_id
    current_user.cases_involved_with.find_by(id: case_id) or raise "Case #{case_id} not found"
  end

  def find_book book_id
    current_user.books_involved_with.find_by(id: book_id) or raise "Book #{book_id} not found"
  end

  def find_query query_id
    Query.where(case_id: current_user.cases_involved_with.select(:id)).find_by(id: query_id) or
      raise "Query #{query_id} not found"
  end

  def find_scorer scorer_id
    current_user.scorers_involved_with.find_by(id: scorer_id) or raise "Scorer #{scorer_id} not found"
  end

  def save! record
    return record if record.save

    raise record.errors.full_messages.to_sentence
  end

  # Analytics::Tracker records through the Ahoy tracker that Ahoy's controller
  # hook puts in Ahoy.instance for each request. MCP requests never pass through
  # a controller, so build one from the MCP request and the key's user
  # (`mcp: true` skips bot filtering, see config/initializers/ahoy.rb).
  def track
    previous = Ahoy.instance
    Ahoy.instance = Ahoy::Tracker.new(request: request, user: current_user, mcp: true)
    yield
  ensure
    Ahoy.instance = previous
  end
end
