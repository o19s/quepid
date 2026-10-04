import { getJson, putJson } from "api/json"

function normalizeUser(data) {
  return {
    ...data,
    defaultScorerId: data.default_scorer_id,
    completedCaseWizard: data.completed_case_wizard,
    casesInvolvedWithCount: data.cases_involved_with_count,
    teamsInvolvedWithCount: data.teams_involved_with_count
  }
}

export function createUserRuntime() {
  let currentUser = null

  return {
    current() {
      return currentUser
    },

    loadCurrent() {
      return getJson("api/users/current").then((data) => {
        currentUser = normalizeUser(data)
        return currentUser
      })
    },

    shownIntroWizard() {
      const url = `api/users/${currentUser.id}`
      return putJson(url, { user: { completed_case_wizard: true } }).then(() => {
        currentUser.completedCaseWizard = true
        return currentUser
      })
    },

    reset() {
      currentUser = null
    }
  }
}
