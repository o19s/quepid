// Angular 1.x shim for splainer-search 3.0.0 (vanilla-JS ESM).
// Registers the `o19s.splainer-search` module consumers expect, backed by
// `createWiredServices(...)`.
import { createFetchClient, createWiredServices, isAbortError } from 'splainer-search/wired.js';

// Route splainer's native fetch promises through Angular's $q so that consumer
// .then() handlers run inside a digest. Otherwise $scope mutations from those
// handlers leave the UI stale until another Angular event triggers a digest.
function withAngularDigest(client) {
  let $q;
  const get$q = () => {
    if ($q) return $q;
    // ng-app="QuepidApp" lives on <body>, not <html>, so the injector is only
    // reachable via the ng-app element (or any descendant) — not document itself.
    const ngApp = document.querySelector('[ng-app]') || document.body;
    $q = angular.element(ngApp).injector().get('$q');
    return $q;
  };
  const wrap = (method) => (...args) => get$q().when(client[method](...args));
  return {
    get: wrap('get'),
    post: wrap('post'),
    jsonp: wrap('jsonp'),
  };
}

const httpClient = withAngularDigest(createFetchClient({ credentials: 'include' }));
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
