'use strict';

// Navigation within the case/try view
// other services may wish to trigger changes in
// the current case or try should use this service
//
// What did I do here, like implement a router on top of my router!?!?
angular.module('QuepidApp')
  .service('caseTryNavSvc', [
    'configurationSvc','$location', '$timeout',
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
        $location.path('/cases/');
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
      
      // Return the protocol Quepid is on
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
        
        // Look for /case/, /cases/, /scorers or /teams/ in url.
        var match = absUrl.match(/(.*?)(\/case\/|\/teams\/|\/scorers\/|\/cases\/)/);
        if (match && match[1]) {
          return match[1]; // Return the part of URL before the pattern
        }
        else {
          console.warn('Neither "/case/", "/cases/", "/scorers", nor "/teams/" found in URL');
        }
      };
      
      this.getQuepidProxyUrl = function () {
        return this.getQuepidRootUrl() + '/proxy/fetch?url=';
      };
      
      this.createSearchEndpointLink = function (searchEndpointId) {
        let link = this.getQuepidRootUrl() + '/search_endpoints/' + searchEndpointId;
        return link;
      };
      
    }
  ]);
