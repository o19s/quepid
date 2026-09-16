export function parseTeamsJson(rawJson) {
  try {
    if (typeof rawJson === "string" && rawJson.trim() !== "") {
      const parsed = JSON.parse(rawJson)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (e) {
    console.error("share-case: invalid teams JSON", e)
  }
  return []
}

// Shared by the four "share with a team" modal controllers (case, book,
// scorer, search endpoint): rebuilds a <select>'s options from the full
// team list minus whichever teams already have this resource, with a
// distinct message for "you have no teams at all" vs. "already shared
// with everyone".
export function populateTeamSelect(selectEl, allTeams, sharedTeams, opts = {}) {
  const {
    placeholder = "Select a team...",
    emptyMessage = "You have no teams yet",
    noneLeftMessage = "No other teams to share with"
  } = opts

  const sharedTeamIds = sharedTeams.map((t) => String(t.id))
  const unsharedTeams = allTeams.filter((team) => !sharedTeamIds.includes(String(team.id)))

  selectEl.innerHTML = `<option value="">${placeholder}</option>`

  if (allTeams.length === 0 || unsharedTeams.length === 0) {
    const option = document.createElement("option")
    option.value = ""
    option.text = allTeams.length === 0 ? emptyMessage : noneLeftMessage
    selectEl.appendChild(option)
    selectEl.disabled = true
  } else {
    unsharedTeams.forEach((team) => {
      const option = document.createElement("option")
      option.value = team.id
      option.text = team.name
      selectEl.appendChild(option)
    })
    selectEl.disabled = false
  }

  selectEl.value = ""
}

export function partitionTeams(teams, caseId) {
  const caseNo = Number(caseId)
  const allTeams = []
  const sharedTeams = []

  teams.forEach((team) => {
    const entry = { id: team.id, name: team.name }
    allTeams.push(entry)
    const cases = Array.isArray(team.cases) ? team.cases : []
    const hasCase = cases.some((c) => {
      const id = c.case_id ?? c.caseNo ?? c.id
      return Number(id) === caseNo
    })
    if (hasCase) sharedTeams.push(entry)
  })

  return { allTeams, sharedTeams }
}
