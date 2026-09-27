import quepidDom from './quepid_dom';
import quepidSearch from './quepid_search';
import quepidStore from './quepid_store';

/**
 * Framework-free runtime for the core case workspace.
 *
 * This is deliberately a small compatibility bridge for the remaining legacy
 * services. The implementation lives in ESM modules; Angular is no longer the
 * bundle that owns those modules. The globals can be removed once the last
 * Angular service consumers have moved to direct imports.
 */
window.quepidDom = quepidDom;
window.quepidSearch = quepidSearch;
window.quepidStore = quepidStore;
