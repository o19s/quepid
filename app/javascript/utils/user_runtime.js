import { apiFetch } from "api/fetch"

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
      return request("api/users/current", { headers: { Accept: "application/json" } }).then(
        async (response) => {
          if (!response.ok) throw new Error(`Unable to load the current user (${response.status})`)
          currentUser = normalizeUser(await response.json())
          return currentUser
        }
      )
    },

    shownIntroWizard() {
      const url = `api/users/${currentUser.id}`
      return request(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ user: { completed_case_wizard: true } })
      }).then(async (response) => {
        if (!response.ok) throw new Error(`Unable to update the current user (${response.status})`)
        currentUser.completedCaseWizard = true
        return currentUser
      })
    },

    reset() {
      currentUser = null
    }
  }
}
