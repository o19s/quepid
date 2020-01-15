# frozen_string_literal: true

json.allCases do
  json.array! @cases do |acase|
    json.caseName         acase.caseName
    json.caseNo           acase.id
    json.owned            acase.user_id == current_user.id

    json.lastTry acase.tries.best.try_number if acase.tries.present? && acase.tries.best.present?
  end
end

json.casesCount current_user.case.not_archived.count
