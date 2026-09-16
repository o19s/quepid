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

export function unsharedTeams(allTeams, sharedTeams) {
  const sharedTeamIds = sharedTeams.map((t) => String(t.id))
  return allTeams.filter((team) => !sharedTeamIds.includes(String(team.id)))
}

export function deactivateListItem(listElement, teamId) {
  if (!teamId || !listElement) return
  const prev = listElement.querySelector(`[data-team-id="${teamId}"]`)
  if (prev) prev.classList.remove("active")
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
