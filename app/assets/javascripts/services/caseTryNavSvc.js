'use strict';

// Navigation within the case/try view
// other services may wish to trigger changes in
// the current case or try should use this service
//
// What did I do here, like implement a router on top of my router!?!?
angular.module('QuepidApp')
  .service('caseTryNavSvc', [
    'configurationSvc', '$location', '$timeout',
    function caseTryNavSvc(configurationSvc, $location, $timeout) {
      var caseNo = 0;
      var tryNo = 0;

      var currNavDelay = 1000;
      var isLoading = false;

      this.isLoading = function () {
        return isLoading;
      };

      this.navigateTo = function (caseTryObj, navDelay) {
        if (navDelay === undefined) {
          navDelay = 1000;
        }
        currNavDelay = navDelay;
        var navCaseNo = caseNo;
        var navTryNo = tryNo;
        var sortBy, sortOrder;
        if ($location.search()) {
          sortBy = $location.search().sort;
          sortOrder = $location.search().reverse;
        }

        if (caseTryObj.hasOwnProperty('caseNo')) {
          navCaseNo = parseInt(caseTryObj.caseNo, 10);
        }
        if (caseTryObj.hasOwnProperty('tryNo')) {
          navTryNo = parseInt(caseTryObj.tryNo, 10);
        }
        else if (caseTryObj.hasOwnProperty('caseNo')) {
          navTryNo = 1;
        }

        $location.search({ 'sort': sortBy, 'reverse': sortOrder });

        isLoading = true;

        // always append a trailing / or ngRoute will double load this
        var path = '/case/' + navCaseNo + '/try/' + navTryNo + '/';
        $location.path(path);
      };

      this.navigationCompleted = function (caseTryObj) {
        caseNo = caseTryObj.caseNo;
        tryNo = caseTryObj.tryNo;

        $timeout(function () {
          isLoading = false;
        }, currNavDelay);
      };

      this.notFound = function () {
        $location.path('/404.html');
      };

      this.navigateToCasesListing = function () {
        window.location.href = this.getQuepidRootUrl() + '/cases';
      };

      this.getCaseNo = function () {
        return caseNo;
      };

      this.getTryNo = function () {
        return tryNo;
      };

      this.specifySearchProxyRequired = function (searchUrl) {
        if (searchUrl) {
          // Browsers only block mixed content when the page is HTTPS and the
          // request target is HTTP; an HTTP page calling an HTTPS endpoint is fine.
          var quepidStartsWithHttps = $location.protocol() === 'https';
          var searchEngineStartsWithHttps = searchUrl.startsWith('https');
          return quepidStartsWithHttps && !searchEngineStartsWithHttps;
        } else {
          return false;
        }
      };

      // Helper to expose Quepid's current protocol for the UI
      this.getQuepidProtocol = function () {
        return $location.protocol() === 'https' ? 'https' : 'http';
      };

      this.appendQueryParams = function (quepidUrl, params) {
        let seperator = '?';
        if (quepidUrl.includes('?')) {
          seperator = '&';
        }
        quepidUrl = quepidUrl + seperator + params;
        return quepidUrl;

      };

      this.getQuepidRootUrl = function () {
        var absUrl = $location.absUrl();

        if (!absUrl.endsWith('/')) {
          absUrl += '/';
        }

        // Look for /case/ in url (Angular route)
        var match = absUrl.match(/(.*?)(\/case\/)/);
        if (match && match[1]) {
          return match[1]; // Return the part of URL before the pattern
        }
        else {
          console.warn('"/case/" not found in URL, using origin as fallback');
          // Fallback: extract base URL from protocol + host + port
          var urlObj = new URL(absUrl);
          return urlObj.origin;
        }
      };

      this.getQuepidProxyUrl = function (searchEndpointId) {
        var base = this.getQuepidRootUrl() + '/proxy/fetch?';
        if (searchEndpointId) {
          base += 'search_endpoint_id=' + searchEndpointId + '&';
        }
        base += 'url=';
        return base;
      };

      this.createSearchEndpointLink = function (searchEndpointId) {
        let link = this.getQuepidRootUrl() + '/search_endpoints/' + searchEndpointId;
        return link;
      };

    }
  ]);
