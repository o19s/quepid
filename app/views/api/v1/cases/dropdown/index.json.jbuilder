# frozen_string_literal: true

json.all_cases do
  json.array! @cases do |acase|
    json.case_name        acase.case_name
    json.caseNo           acase.id
    json.owned            acase.owner_id == current_user.id

    json.last_try_number acase.tries.latest.try_number if acase.tries.present? && acase.tries.latest.present?
  end
end

json.cases_count current_user.cases_involved_with.not_archived.count
