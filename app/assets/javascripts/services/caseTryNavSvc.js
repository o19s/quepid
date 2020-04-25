'use strict';

// Navigation within the case/try view
// other services may wish to trigger changes in
// the current case or try should use this service
//
// What did I do here, like implement a router on top of my router!?!?
angular.module('QuepidApp')
  .service('caseTryNavSvc', [
    '$location', '$timeout', '$window',
    function caseTryNavSvc($location, $timeout, $window) {
      var caseNo = 0;
      var tryNo = 0;
      var bootstrapPath = null;

      var currNavDelay = 1000;
      var isLoading = false;


      this.pathRequested = function(caseTryObj) {
        bootstrapPath = caseTryObj;
      };

      this.isLoading = function() {
        return isLoading;
      };


      this.bootstrap = function() {
        if (bootstrapPath) {
          this.navigateTo(bootstrapPath);
          bootstrapPath = null;
        } else {
          $window.location.reload();
        }
      };

      this.navigateTo = function(caseTryObj, navDelay) {
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
          navTryNo = 0;
        }

        $location.search({'sort': sortBy, 'reverse': sortOrder});

        isLoading = true;

        // always append a trailing / or ngRoute will double load this
        var path = '/case/' + navCaseNo + '/try/' + navTryNo + '/';
        $location.path(path);
      };

      this.navigationCompleted = function(caseTryObj) {
        caseNo = caseTryObj.caseNo;
        tryNo = caseTryObj.tryNo;

        $timeout(function() {
          isLoading = false;
        }, currNavDelay);
      };

      this.notFound = function() {
        $location.path('/404.html');
      };

      this.getCaseNo = function() {
        return caseNo;
      };

      this.getTryNo = function() {
        return tryNo;
      };

    }
  ]);
