'use strict';

angular.module('QuepidApp')
  .controller('BrowseQueryModalInstanceCtrl', [
    '$quepidModalInstance',
    'clipboardSvc',
    'query',
    'selectedTry',
    'engineName',
    function (
      $quepidModalInstance,
      clipboardSvc,
      query,
      selectedTry,
      engineName
    ) {
      var ctrl = this;

      ctrl.engineName = engineName;
      ctrl.url = query.browseUrl();

      var headers = {};

      if (selectedTry.customHeaders) {
        var customHeaders = selectedTry.customHeaders;
        if (typeof customHeaders === 'string') {
          try {
            customHeaders = JSON.parse(customHeaders);
          }
          catch (e) {
            customHeaders = {};
          }
        }
        angular.extend(headers, customHeaders);
      }

      // Solr's Basic Auth isn't part of customHeaders (see queriesSvc.js), so fold it
      // in here the same way the browser's own Basic Auth prompt would.
      if (selectedTry.basicAuthCredential) {
        headers.Authorization = 'Basic ' + window.btoa(selectedTry.basicAuthCredential);
      }

      ctrl.hasHeaders = Object.keys(headers).length > 0;

      // curl-generator doesn't quote/escape the url it's given (see its source), so an
      // unquoted url containing shell-meaningful characters (spaces, *, &, ?, ") - which
      // any real query string will - falls apart when pasted into a terminal. Quote it
      // ourselves the same way curl-generator quotes header values.
      function shellQuoteSingle(str) {
        return '\'' + String(str).replace(/'/g, '\'\\\'\'') + '\'';
      }

      ctrl.curlCommand = window.CurlGenerator({
        url: shellQuoteSingle(ctrl.url),
        method: 'GET',
        headers: headers
      });

      ctrl.copied = false;

      ctrl.copyCurlCommand = function () {
        clipboardSvc.copy(ctrl.curlCommand).then(function () {
          ctrl.copied = true;
        }, angular.noop);
      };

      ctrl.cancel = function () {
        $quepidModalInstance.dismiss('cancel');
      };
    }
  ]);
