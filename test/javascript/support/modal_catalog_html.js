// HTTP fixtures for Rails-rendered catalogs. Rails tests separately verify
// authorization, escaping, membership and the scorer payload in the real views.
function row(tag, attributes, text) {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  element.textContent = text
  return element
}

export function teamCatalogHtml(allTeams, sharedTeams = []) {
  const catalog = document.createElement("div")
  catalog.setAttribute("data-share-catalog", "")
  for (const shared of [false, true]) {
    const list = document.createElement("div")
    list.dataset.catalogList = shared ? "shared" : "shareable"
    allTeams.forEach((team, index) => {
      if (sharedTeams.some((item) => item.id === team.id) !== shared) return
      list.append(row("button", {
        type: "button",
        class: `list-group-item list-group-item-action${shared ? " list-group-item-success" : ""}`,
        "data-team-id": team.id,
        "data-team-order": index,
        "data-share-case-core-team-id-param": team.id,
        "data-action": `click->share-case-core#${shared ? "selectSharedTeam" : "selectShareTeam"}`
      }, team.name || `Team ${team.id}`))
    })
    catalog.append(list)
  }
  return catalog.outerHTML
}

export function bookCatalogHtml(books = []) {
  const catalog = document.createElement("ul")
  catalog.setAttribute("data-book-catalog", "")
  const attributes = {
    class: "list-group-item",
    "data-judgements-core-target": "item",
    "data-action": "click->judgements-core#selectBook"
  }
  const none = row("li", { ...attributes, "data-judgements-core-book-id-param": "" }, "")
  none.append(row("em", {}, "None (disconnect from any book)"))
  catalog.append(none)
  for (const book of books) {
    const item = row("li", { ...attributes, "data-judgements-core-book-id-param": book.id }, "")
    item.append(row("span", { "data-slot": "name" }, book.name))
    item.append(row("a", {
      href: `books/${book.id}`,
      "data-slot": "view",
      "data-action": "click->judgements-core#viewBook"
    }, "View"))
    catalog.append(item)
  }
  return catalog.outerHTML
}

export function scorerCatalogHtml({ communal_scorers = [], user_scorers = [] } = {}) {
  const catalog = document.createElement("div")
  catalog.setAttribute("data-scorer-catalog", "")
  for (const [kind, scorers] of [["communal", communal_scorers], ["custom", user_scorers]]) {
    const list = document.createElement("ul")
    list.dataset.catalogList = kind
    for (const scorer of scorers) {
      list.append(row("li", {
        class: "list-group-item",
        "data-pick-scorer-core-target": "item",
        "data-pick-scorer-core-scorer-id-param": scorer.scorer_id,
        "data-scorer-json": JSON.stringify(scorer),
        "data-action": "click->pick-scorer-core#selectScorer"
      }, scorer.name))
    }
    catalog.append(list)
  }
  return catalog.outerHTML
}
