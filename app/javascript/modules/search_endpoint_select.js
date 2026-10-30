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

export function createSearchEndpointSelect(element, placeholder) {
  const blank = document.createElement("option")
  blank.value = ""
  element.replaceChildren(blank)
  const select = new TomSelect(element, {
    maxItems: 1,
    create: false,
    refreshThrottle: 0,
    placeholder,
    render: { option: renderEndpoint, item: renderEndpoint },
    onDropdownOpen() {
      if (this.wrapper.closest("#dev-settings")) this.control.scrollIntoView({ block: "nearest" })
    }
  })
  select.wrapper.classList.add("search-endpoint-select")
  return select
}

export function updateSearchEndpointSelect(select, endpoints, selectedId) {
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
}
