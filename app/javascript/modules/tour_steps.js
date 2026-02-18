// Tour step definitions for the workspace guided tour.
// Each step targets an existing DOM element and shows a popover with instructions.
const TOUR_STEPS = [
  {
    target: "[data-controller='add-query']",
    title: "Add Queries",
    content: "Start by adding search queries here. These are the queries you want to evaluate and improve.",
    placement: "bottom"
  },
  {
    target: "[data-controller='settings-panel'] [data-settings-panel-target='trigger']",
    title: "Settings Panel",
    content: "Configure your search endpoint, query parameters, and try settings here.",
    placement: "bottom"
  },
  {
    target: ".query-list",
    title: "Query List",
    content: "Your queries appear here. Click a query to see its search results. Rate documents to evaluate relevance.",
    placement: "right"
  },
  {
    target: ".results-pane",
    title: "Results Pane",
    content: "Search results appear here when you select a query. Click the rating badge on each document to judge its relevance.",
    placement: "left"
  },
  {
    target: "[data-controller='scorer-panel']",
    title: "Scorer",
    content: "Your relevance score is shown here. It updates automatically as you rate documents.",
    placement: "bottom"
  }
]

export default TOUR_STEPS
