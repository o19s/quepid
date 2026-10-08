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
