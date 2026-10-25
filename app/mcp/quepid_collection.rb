# frozen_string_literal: true

# Base of every MCP collection: rows are scoped to the API token's owner, the
# same way the REST API and the UI scope them (owned, or shared via a team).
# A request without a user (misconfiguration) sees nothing rather than everything.
class QuepidCollection < RorMcp::Collection
  abstract!

  def scope context
    user = context.is_a?(Hash) ? context[:user] : nil
    return self.class.model.none if user.nil?

    scope_for user
  end

  def scope_for _user
    raise NotImplementedError
  end

  private

  def visible_case_ids user
    user.cases_involved_with.select(:id)
  end

  def visible_book_ids user
    user.books_involved_with.select(:id)
  end
end
