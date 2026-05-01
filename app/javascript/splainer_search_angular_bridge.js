/**
 * splainer-search 3.x is a plain ESM library (no AngularJS); Quepid still injects
 * `fieldSpecSvc`, `searchSvc`, `docResolverSvc`, etc. under `o19s.splainer-search`.
 * This file registers those singleton names from {@link splainer-search/wired.js}.
 */
'use strict';

import { createFetchClient, createWiredServices } from 'splainer-search/wired.js';

const api = createWiredServices(
  createFetchClient({ credentials: 'include' }),
);

const splainerAngular = angular.module('o19s.splainer-search', []);

Object.keys(api).forEach(function (name) {
  splainerAngular.value(name, api[name]);
});

// splainer-search 2.x registered this as Angular .factory('SettingsValidatorFactory', …);
// the wired graph exposes the same constructor under settingsValidatorFactory only.
splainerAngular.value('SettingsValidatorFactory', api.settingsValidatorFactory);
