# frozen_string_literal: true

# AI judges are users (STI); only non-sensitive columns are published - never
# llm_key, email or anything account related.
class AiJudgeCollection < QuepidCollection
  model AiJudge
  description "An LLM-backed judge that rates a book's query/document pairs."
  fields :id, :name, :system_prompt, :escalates_to, :created_at, :updated_at

  computed :owner_id, :integer, sql: '{table}.owner_id', doc: 'id of the owning user (no user collection)'

  instructions <<~TXT
    An AI judge rates book query/document pairs with an LLM. judgement.user_id equals an AI judge's
    id when that judge made the judgement. "escalates_to" is the judge it wakes when unsure.
  TXT

  def scope_for user
    AiJudge.for_user(user)
  end
end
