# frozen_string_literal: true

json.allCases do
  json.array! @cases do |acase|
    json.case_name        acase.case_name
    json.caseNo           acase.id
    json.owned            acase.user_id == current_user.id

    json.last_try_number acase.tries.best.try_number if acase.tries.present? && acase.tries.best.present?
  end
end

json.casesCount current_user.cases_involved_with.not_archived.count
