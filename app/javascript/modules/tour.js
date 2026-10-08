import Shepherd from "shepherd.js"

// Walkthrough shown after a user's first case wizard (see wizard_controller.js).
function setupTour() {
  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      classes: "quepid-tour-step",
      scrollTo: true,
      cancelIcon: { enabled: true }
    }
  })

  tour.addStep({
    id: "case-header",
    title: "Case Header",
    text: "This is the case header.<br />It is where you can see the following about the current case you have open: name, try number, and score.",
    attachTo: { element: "#case-header", on: "bottom" },
    buttons: [
      {
        text: "Exit",
        classes: "shepherd-button-secondary",
        action: () => tour.cancel()
      },
      {
        text: "Next",
        action: () => tour.next()
      }
    ]
  })

  tour.addStep({
    id: "case-score",
    title: "Case Score",
    text: "This is your case score.<br />It is the average score (percentage) of all the queries.<br />It will update automatically each time a query gets updated.",
    attachTo: { element: ".case-score", on: "right" },
    buttons: [
      {
        text: "Back",
        classes: "shepherd-button-secondary",
        action: () => tour.back()
      },
      {
        text: "Next",
        action: () => tour.next()
      }
    ]
  })

  tour.addStep({
    id: "add-query",
    title: "Add Query",
    text: 'Need to add more queries to your case for testing? You can do it here.<br />Go ahead, add a query. We will wait...<br />Try "Toy Story" if you are using the default TMDB we set you up with.',
    attachTo: { element: 'form[data-controller="add-query"]', on: "right" },
    advanceOn: { selector: "#add-query-submit", event: "click" },
    buttons: [
      {
        text: "Back",
        classes: "shepherd-button-secondary",
        action: () => tour.back()
      }
    ]
  })

  tour.addStep({
    id: "queries",
    title: "Queries",
    text: "Once you add queries, you will be able to see them in this section.<br />You can expand a query by clicking on the query text or the icon on the right.",
    attachTo: { element: "ul.results-list-element", on: "top" },
    buttons: [
      {
        text: "Back",
        classes: "shepherd-button-secondary",
        action: () => tour.back()
      },
      {
        text: "Next",
        action: () => tour.next()
      }
    ]
  })

  tour.addStep({
    id: "case-actions",
    title: "Case Actions",
    text: "Anything you want to do with a case, you will do it from here.<br />This is a comprehensive list of all the possible actions you have at your disposal.",
    attachTo: { element: "#case-actions", on: "bottom" },
    buttons: [
      {
        text: "Back",
        classes: "shepherd-button-secondary",
        action: () => tour.back()
      },
      {
        text: "Next",
        action: () => tour.next()
      }
    ]
  })

  tour.addStep({
    id: "tune-relevance",
    title: "Tune Relevance",
    text: 'There are many awesome things you can do, but the best place to start is by tuning your case.<br />So let\'s unlock a bunch of awesomeness by clicking the "Tune Relevance" link.',
    attachTo: { element: "#tune-relevance-link", on: "bottom" },
    advanceOn: { selector: "#tune-relevance-link a", event: "click" },
    buttons: [
      {
        text: "Back",
        classes: "shepherd-button-secondary",
        action: () => tour.back()
      }
    ]
  })

  tour.addStep({
    id: "tune",
    title: "Tune Relevance",
    text: `This is where all the magic happens!<br />If you are not familiar with how this work, read the <a href="http://quepidapp.com/docs/#tuning" target="_blank" rel="noopener noreferrer" title="Knowledge Base">Tuning Relevance</a> section in the Knowledge Base.<br />TL;DR: always make sure this <code>#$query##</code> exists somewhere.<br />Let's change this up and see what happens.<br />If you are using Solr, change the query sandbox to: <code>q=#$query##&defType=edismax&qf=title overview</code><br />or to <code>{ \
"query": { \
"match": { \
"title": "#$query##" \
} \
} \
}</code> if you are using Elasticsearch,<br /> or add <code>"restrictSearchableAttributes": [ \
    "title" \
  ]</code> for Algolia, (adjust appropriately if you are not using the demo case).`,
    attachTo: { element: ".pane_east", on: "left" },
    advanceOn: { selector: "#tune-relevance-link a", event: "click" },
    buttons: [
      {
        text: "Back",
        classes: "shepherd-button-secondary",
        action: () => tour.back()
      },
      {
        text: "Next",
        action: () => tour.next()
      }
    ]
  })

  tour.addStep({
    id: "rerun-search",
    title: "Rerun Search",
    text: 'Now click on the "Rerun My Searches!" button<br />on the bottom to see the changes take effect.',
    attachTo: { element: "#query-sandbox-action", on: "top" },
    advanceOn: { selector: "#query-sandbox-action", event: "click" },
    buttons: [
      {
        text: "Back",
        classes: "shepherd-button-secondary",
        action: () => tour.back()
      }
    ]
  })

  tour.addStep({
    id: "done",
    title: "TADA!",
    text: 'And there you have it, that\'s how Quepid works. There are many other areas to explore, but now that you know where to look, we will leave the rest to you.<br />We recommend that you check out the other tabs in the "Tune Relevance" pane, as well as other sections of the app from the header. <br />Also, make sure to stop by the <a href="http://quepidapp.com/docs" target="_blank" rel="noopener noreferrer" title="Knowledge Base">Knowledge Base</a> section for detailed info and the <a href="https://github.com/o19s/quepid/wiki/Videos-on-Learning-to-use-Quepid" title="Tutorials">Tutorials</a> section for some advanced videos.  Lastly our <a href="https://github.com/o19s/quepid/wiki" target="_blank" rel="noopener noreferrer" title="Wiki">Wiki</a> is looking for contributions!',
    buttons: [
      {
        text: "Finish",
        action: () => tour.complete()
      }
    ]
  })

  return tour
}

export function setupAndStartTour() {
  const tour = setupTour()
  tour.start()
  return tour
}
