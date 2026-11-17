import TomSelect from "tom-select"

function renderEndpoint(data) {
  const row = document.createElement("div")
  row.className = "d-flex align-items-center gap-2"
  if (data.src) {
    const icon = document.createElement("img")
    icon.src = data.src
    icon.alt = ""
    icon.width = 20
    icon.height = 20
    row.append(icon)
  }
  const label = document.createElement("span")
  label.textContent = data.text
  row.append(label)
  return row
}

function refreshEndpointSummary(select, summary) {
  const total = Object.keys(select.options).filter((id) => id !== "").length
  const matches = select.search(select.inputValue()).items.length
  const shown = select.dropdown_content.querySelectorAll("[data-selectable]").length
  if (!total) {
    summary.textContent = "No endpoints available."
  } else if (!select.inputValue()) {
    summary.textContent = `Showing ${shown} of ${total} endpoints. Type to search all endpoints.`
  } else if (shown < matches) {
    summary.textContent = `Showing ${shown} of ${matches} matches. Keep typing to narrow.`
  } else {
    summary.textContent = `${matches} matching ${matches === 1 ? "endpoint" : "endpoints"}.`
  }
}

export function createSearchEndpointSelect(element, placeholder) {
  const blank = document.createElement("option")
  blank.value = ""
  element.replaceChildren(blank)
  const select = new TomSelect(element, {
    maxItems: 1,
    maxOptions: 50,
    create: false,
    refreshThrottle: 0,
    placeholder,
    render: { option: renderEndpoint, item: renderEndpoint },
    onDropdownOpen() {
      if (this.wrapper.closest("#dev-settings")) this.control.scrollIntoView({ block: "nearest" })
    }
  })
  const summary = document.createElement("div")
  summary.className = "p-2 border-top small text-body-secondary"
  summary.setAttribute("role", "status")
  select.dropdown.append(summary)
  select.hook("after", "refreshOptions", () => refreshEndpointSummary(select, summary))
  select.wrapper.classList.add("search-endpoint-select")
  return select
}

export function updateSearchEndpointSelect(select, endpoints, selectedId) {
  select.settings.placeholder = endpoints.length
    ? `Search ${endpoints.length} ${endpoints.length === 1 ? "endpoint" : "endpoints"}…`
    : "Search endpoints…"
  select.clear(true)
  select.clearOptions()
  const blank = document.createElement("option")
  blank.value = ""
  blank.textContent = select.settings.placeholder
  const options = endpoints.map((endpoint) => {
    const option = document.createElement("option")
    option.value = String(endpoint.id)
    option.textContent = endpoint.name
    option.dataset.src = `images/${endpoint.mapperBasedSearchEngineId || endpoint.searchEngine}-icon.png`
    return option
  })
  select.input.replaceChildren(blank, ...options)
  select.sync()
  select.setValue(String(selectedId ?? ""), true)
  select.inputState()
  select.refreshOptions(false)
}
