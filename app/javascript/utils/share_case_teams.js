export function deactivateListItem(listElement, teamId) {
  if (!teamId || !listElement) return
  const prev = listElement.querySelector(`[data-team-id="${teamId}"]`)
  if (prev) prev.classList.remove("active")
}
