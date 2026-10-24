// Load Rails-page controllers only when their data-controller appears. Core's
// explicit esbuild entry registers its own controllers and keeps the
// splainer-search runtime out of ordinary Rails pages.
import { application } from "controllers/application"
import { lazyLoadControllersFrom } from "@hotwired/stimulus-loading"
lazyLoadControllersFrom("controllers", application)
