# frozen_string_literal: true

# Same raw attributes this endpoint has always returned, plus the fields the UI needs to navigate.
json.merge! @case.as_json
json.case_id @case.id
json.redirect_url case_core_url(@case, @case.last_try_number)
