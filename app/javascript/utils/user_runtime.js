import { apiFetch } from "api/fetch"
import { requestJson } from "api/json"

function normalizeUser(data) {
  return {
    ...data,
    defaultScorerId: data.default_scorer_id,
    completedCaseWizard: data.completed_case_wizard,
    casesInvolvedWithCount: data.cases_involved_with_count,
    teamsInvolvedWithCount: data.teams_involved_with_count
  }
}

export function createUserRuntime({ request = apiFetch } = {}) {
  let currentUser = null

  return {
    current() {
      return currentUser
    },

    loadCurrent() {
      return requestJson("api/users/current", {}, request).then((data) => {
        currentUser = normalizeUser(data)
        return currentUser
      })
    },

    shownIntroWizard() {
      const url = `api/users/${currentUser.id}`
      return requestJson(
        url,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user: { completed_case_wizard: true } })
        },
        request
      ).then(() => {
        currentUser.completedCaseWizard = true
        return currentUser
      })
    },

    reset() {
      currentUser = null
    }
  }
}
