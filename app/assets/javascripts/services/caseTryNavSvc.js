'use strict';

// Navigation within the case/try view
// other services may wish to trigger changes in
// the current case or try should use this service
//
// What did I do here, like implement a router on top of my router!?!?
angular.module('QuepidApp')
  .service('caseTryNavSvc', [
    'configurationSvc','$location', '$window',
    function caseTryNavSvc(configurationSvc, $location, $window) {
      var caseNo = 0;
      var tryNo = 0;

      var isLoading = false;

      this.isLoading = function () {
        return isLoading;
      };

      // Real page navigation (not an in-SPA route change) -- Rails' own
      // CoreController#index re-renders the whole shell for the new case/try.
      // Every caller here reacts to a mutation that already completed
      // server-side, so there's no client state left to preserve across it.
      this.navigateTo = function (caseTryObj) {
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

        var url = this.getQuepidRootUrl() + '/case/' + navCaseNo + '/try/' + navTryNo;
        var query = new URLSearchParams();
        if (sortBy) {
          query.set('sort', sortBy);
        }
        if (sortOrder) {
          query.set('reverse', sortOrder);
        }
        var queryString = query.toString();
        if (queryString) {
          url += '?' + queryString;
        }

        $window.location.assign(url);
      };

      this.navigationCompleted = function (caseTryObj) {
        caseNo = caseTryObj.caseNo;
        tryNo = caseTryObj.tryNo;
        isLoading = false;
      };

      // Generic $http-failure handler for several unrelated mutations (case
      // create/rename/nightly-toggle/book-association, dropdown-cases fetch,
      // settings fetch) -- none of these are really "not found" errors, and
      // none showed any feedback before this flash. Stay on the page and
      // flash instead of navigating away: those callers are deep in
      // caseSvc/settingsSvc with no page-navigation context of their own, so
      // there's nowhere good to navigate *to*, and a real navigation here
      // used to strand the user on a bare, unbranded error page.
      this.notFound = function () {
        window.quepidDom.flash.show('error', 'Unable to complete your request. Please try again.');
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
      
      // If Quepid is running on HTTPS, like on Heroku, then it needs to switch
      // to HTTP in order to make calls to a Solr that is running in HTTP as well, otherwise
      // you get this "Mixed Content", which browsers block as a security issue.
      // https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content
      this.needToRedirectQuepidProtocol = function (searchUrl) {
        if (searchUrl) {
          // Figure out if we need to redirect based on our search engine's url.
          var quepidStartsWithHttps = $location.protocol() === 'https';
          var searchEngineStartsWithHttps = searchUrl.startsWith('https');
  
          return (quepidStartsWithHttps !== searchEngineStartsWithHttps);
        } else {
          return false;
        }
      };
      
      // Return the tuple [quepidUrlToSwitchTo, protocolToSwitchTo]
      this.swapQuepidUrlTLS = function () {
        // Grab just the absolute url without any trailing query parameters
        var absUrl = $location.absUrl();
        // In development you might be on port 3000, and for https we need you not on port 3000
        absUrl = absUrl.replace(':3000', '');
        var n = absUrl.indexOf('?');
        
        var quepidUrlStartsWithHttps = absUrl.startsWith('https');
        var quepidUrlToSwitchTo = absUrl.substring(0, n !== -1 ? n : absUrl.length);
        var protocolToSwitchTo = null;
        if (quepidUrlStartsWithHttps) {
          protocolToSwitchTo = 'http';
          quepidUrlToSwitchTo = quepidUrlToSwitchTo.replace('https', 'http');
        }
        else {
          protocolToSwitchTo = 'https';
          quepidUrlToSwitchTo = quepidUrlToSwitchTo.replace('http', 'https');
        }
        
        let separator = '?';
        if (quepidUrlToSwitchTo.includes('?')) {
          separator = '&';
        }
        
        quepidUrlToSwitchTo = quepidUrlToSwitchTo + separator + 'protocolToSwitchTo=' + protocolToSwitchTo;
        
        return [quepidUrlToSwitchTo, protocolToSwitchTo];
      };
      
      this.getQuepidProtocol = function () {
        // Grab just the absolute url without any trailing query parameters
        var absUrl = $location.absUrl();
        var protocolToSwitchTo = null;
        if (absUrl.startsWith('https')){
          protocolToSwitchTo = 'http';
        }
        else {
          protocolToSwitchTo = 'https';
        }
        
        return protocolToSwitchTo;
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
