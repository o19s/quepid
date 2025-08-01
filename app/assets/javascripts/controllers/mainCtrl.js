'use strict';

angular.module('QuepidApp')
  // there's a lot of dependencies here, but this guy
  // is responsible for bootstrapping everyone so...
  .controller('MainCtrl', [
    '$scope', '$routeParams', '$rootScope', '$log',
    'flash',
    'caseSvc', 'settingsSvc', 'querySnapshotSvc', 'caseTryNavSvc',
    'queryViewSvc', 'queriesSvc', 'docCacheSvc', 'diffResultsSvc', 'scorerSvc',
    'paneSvc',
    function (
      $scope, $routeParams, $rootScope, $log,
      flash,
      caseSvc, settingsSvc, querySnapshotSvc, caseTryNavSvc,
      queryViewSvc, queriesSvc, docCacheSvc, diffResultsSvc, scorerSvc,
      paneSvc
    ) {
      $log.debug('NEW MAIN CTRL');

      var caseNo  = parseInt($routeParams.caseNo, 10);
      var tryNo   = parseInt($routeParams.tryNo, 10);

      var initialCaseNo = angular.copy(caseTryNavSvc.getCaseNo());

      var caseChanged = function() {
        return initialCaseNo !== caseNo;
      };

      var getSearchEngine = function(tryNo) {
        var settings = settingsSvc.editableSettings();
        if (settings.hasOwnProperty('getTry')) {
          var aTry = settings.getTry(tryNo);
          if (aTry) {
            return aTry.searchUrl;
          }
        }
        return null;
      };

      var searchEngineChanged = function() {
        return getSearchEngine(caseTryNavSvc.getTryNo()) !== getSearchEngine(tryNo);
      };

      var init = function() {
        // Make sure we empty stuff from the previous case
        if ( caseChanged() ) {
          queriesSvc.reset();
        }

        angular.forEach(queriesSvc.queries, function(query) {
          query.reset();
        });
      };

      var bootstrapCase = function() {
        return caseSvc.get(caseNo)
          .then(function(acase) {
            if (angular.isUndefined(acase)){
              throw new Error('Could not retrieve case ' + caseNo + '.   Confirm that the case has been shared with you via a team you are a member of!');
            }

            caseSvc.selectTheCase(acase);
            settingsSvc.setCaseTries(acase.tries);
            if ( isNaN(tryNo) ) {  // If we didn't specify a tryNo via the URL
              tryNo = acase.lastTry;
            }

            settingsSvc.setCurrentTry(tryNo);
            if (!settingsSvc.isTrySelected()){
              flash.to('search-error').error = 'The try that was specified for the case does not actually exist!';
            }
            else {
              if (settingsSvc.editableSettings().proxyRequests === true){
                $scope.showTLSChangeWarning = false;
              }
              else if  (caseTryNavSvc.needToRedirectQuepidProtocol(settingsSvc.editableSettings().searchUrl)){
                $log.info('Need to redirect browser to different TLS');
                var message = "";
                if (settingsSvc.editableSettings().searchEngine === 'solr' && settingsSvc.editableSettings().apiMethod === 'JSONP'){
                  //message = "Quepid is running on " + caseTryNavSvc.getQuepidProtocol() + ", which doesn't match Solr.  Please either swap to the proxied connection, or make sure Solr is on the same HTTP protocol.";
                  message = "You have specified a search engine url that is on a different protocol ( <code>" + caseTryNavSvc.getQuepidProtocol() + "</code> ) than Quepid is on. Please either swap to the proxied connection, or make sure "+ settingsSvc.editableSettings().searchEngine + " is on the same HTTP protocol.";
                }
                throw new Error("Blocked Request: mixed-content. "+ message); // Signal that we can't run the query with this setup.
              }
            }
          });
      };

      var loadQueries = function() {
        var newSettings = settingsSvc.editableSettings();
        if ( caseChanged() || searchEngineChanged() ) {
          if ( caseChanged() ) {
            queryViewSvc.reset();
            docCacheSvc.empty();
            scorerSvc.bootstrap(caseNo);
          }
          diffResultsSvc.setDiffSetting(null);
          docCacheSvc.invalidate();
        }

        return docCacheSvc.update(newSettings)
          .then(function() {
            var bootstrapped = false;

            return queriesSvc.changeSettings(caseNo, newSettings)
              .then(function() {
                if (!bootstrapped) {
                  flash.error                    = '';
                  flash.success                  = '';
                  flash.to('search-error').error = '';

                  bootstrapped = true;
                  return queriesSvc.searchAll()
                    .then(function() {
                      flash.success = 'All queries finished successfully!';
                    }, function(errorMsg) {
                      var mainErrorMsg = 'Some queries failed to resolve!';

                      flash.error = mainErrorMsg;
                      flash.to('search-error').error = errorMsg;
                    });
                }
              });
          });
      };

      var loadSnapshots = function() {
        return querySnapshotSvc.bootstrap(caseNo);
      };

      var updateCaseMetadata = function() {
        caseSvc.trackLastViewedAt(caseNo);
        caseSvc.fetchDropdownCases();
      };

      init();

      caseTryNavSvc.navigationCompleted({
        caseNo:       caseNo,
        tryNo:        tryNo
      });

      // While not perfect, at least the site doesn't blow up if you don't
      // have any cases.
      if ( caseNo === 0 ) {
        flash.error = 'You don\'t have any Cases created in Quepid.  Click \'Create a Case\' from the Relevancy Cases dropdown to get started.';
      }
      else if ( caseNo > 0 ) {
        queriesSvc.querySearchPromiseReset();

        bootstrapCase()
          .then(function() {
            loadQueries();
            loadSnapshots();  // this is here just to set the caseNo in the querySnapshotSvc.
            updateCaseMetadata();
            paneSvc.refreshElements();
          }).catch(function(error) {            
            // brittle logic, but check if we throw the TLS error or if it's from something else.'
            var message = error.message;
            if (message.startsWith('Blocked Request')){
              var resultsTuple = caseTryNavSvc.swapQuepidUrlTLS();
            
              var quepidUrlToSwitchTo = resultsTuple[0];
              var protocolToSwitchTo = resultsTuple[1];
            
              //flash.to('search-error').error = '<a href="' + quepidUrlToSwitchTo + '" class="btn btn-primary form-control">Click Here to <span class="glyphicon glyphicon-refresh"></span> Reload Quepid in <code>' + protocolToSwitchTo + '</code> Protocol!';
              flash.to('search-error').error = message;
            }
            else if (message.startsWith('Could not retrieve case')){
              flash.to('search-error').error = message;
            }
            else {
              flash.to('search-error').error = 'Could not load the case ' + caseNo + ' due to: ' + message;
            }
            //loadSnapshots();
            //updateCaseMetadata();
            paneSvc.refreshElements();
          });

        // Sets up the panes stuff only when needed
        // Makes sure state is persisted even after reload.
        // This is used when the user hits "Rerun My Searches!" and wants to
        // continue tweaking the settings, it would keep the pane open.
        $rootScope.devSettings = $rootScope.devSettings || false;

        $scope.toggleDevSettings = function() {
          $rootScope.devSettings = !$rootScope.devSettings;
          $(document).trigger('toggleEast');
        };
      }
    }
  ]);
