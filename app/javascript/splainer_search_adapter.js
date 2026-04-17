// Angular 1.x shim for splainer-search 3.0.0 (vanilla-JS ESM).
// Registers the `o19s.splainer-search` module consumers expect, backed by
// `createWiredServices(...)` from the rewrite. See docs/splainer_search_v3_migration.md.
import { createFetchClient, createWiredServices, isAbortError } from 'splainer-search/wired.js';

const httpClient = createFetchClient();
const api = createWiredServices(httpClient);

const ngModule = angular.module('o19s.splainer-search', []);

[
  'searchSvc',
  'fieldSpecSvc',
  'normalDocsSvc',
  'esExplainExtractorSvc',
  'solrExplainExtractorSvc',
  'esUrlSvc',
  'solrUrlSvc',
  'vectaraUrlSvc',
  'queryTemplateSvc',
  'explainSvc',
  'vectorSvc',
  'docResolverSvc',
  'utilsSvc',
  'transportSvc',
  'activeQueries',
].forEach(function (name) {
  ngModule.value(name, api[name]);
});

// Quepid injects this under the PascalCase name and uses it as a constructor.
ngModule.value('SettingsValidatorFactory', api.settingsValidatorFactory);

ngModule.constant('isAbortError', isAbortError);
