// Tour step definitions for the workspace guided tour.
// Each step targets an existing DOM element and shows a popover with instructions.
// Mirrors the 9-step Angular/Shepherd.js tour adapted for the Stimulus workspace layout.
const TOUR_STEPS = [
  {
    target: "[data-controller='inline-edit']:first-of-type",
    title: 'Case Header',
    content:
      'This is your case name and try number. Double-click either to rename. The try number tracks each iteration of your search configuration.',
    placement: 'bottom',
  },
  {
    target: "[data-controller='scorer-panel']",
    title: 'Case Score',
    content:
      'This is your case score — the average relevance score across all queries. It updates automatically each time you rate documents or change your search configuration.',
    placement: 'bottom',
  },
  {
    target: "[data-controller='add-query']",
    title: 'Add Queries',
    content:
      "Add search queries here to start evaluating relevance. Try 'Toy Story' if you're using the TMDB demo. You can add multiple queries separated by semicolons.",
    placement: 'bottom',
  },
  {
    target: '.query-list',
    title: 'Query List',
    content:
      'Your queries appear here. Click a query to see its search results. You can drag to reorder, filter by text, and sort by name, score, or modification date.',
    placement: 'right',
  },
  {
    target: '.d-flex.gap-2.ms-auto',
    title: 'Case Actions',
    content:
      'Everything you can do with a case is here: evaluate all queries, clone, export, import ratings, delete, share with teams, manage judgements, and compare snapshots.',
    placement: 'bottom',
  },
  {
    target: "[data-controller='settings-panel'] [data-settings-panel-target='trigger']",
    title: 'Tune Relevance',
    content:
      'This is where the magic happens! Click Settings to open the query sandbox where you can tune your search parameters, change endpoints, and configure field display.',
    placement: 'bottom',
  },
  {
    target: "[data-controller='run-evaluation']",
    title: 'Run Evaluation',
    content:
      "Click Evaluate to re-run all your queries against the search engine. This scores every query and updates your case score. You'll see live progress as each query is scored.",
    placement: 'bottom',
  },
  {
    target: '.results-pane',
    title: 'Results Pane',
    content:
      'Search results appear here when you select a query. Click the rating badge on each document to judge its relevance. Use the bulk rating bar to rate all visible results at once.',
    placement: 'left',
  },
  {
    target: "[data-controller='tour']",
    title: "You're All Set!",
    content:
      "That's how Quepid works! Explore the case actions toolbar for advanced features like snapshots, diff comparisons, and exporting. Check the Knowledge Base for detailed guides and tutorials.",
    placement: 'bottom',
  },
];

export default TOUR_STEPS;
