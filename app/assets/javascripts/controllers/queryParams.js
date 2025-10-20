'use strict';

angular.module('QuepidApp')
  .controller('QueryParamsCtrl', [
    '$scope',
    'esUrlSvc','caseTryNavSvc','searchEndpointSvc',
    'TryFactory',
    function ($scope,
      esUrlSvc, caseTryNavSvc,searchEndpointSvc,
      TryFactory) {

      $scope.qp = {};
      $scope.qp.curTab = 'developer';

      $scope.caseNo = caseTryNavSvc.getCaseNo();

      $scope.showQueryParamsWarning = false;
      $scope.queryParamsWarning = '';

      $scope.showESTemplateWarning = false;

      $scope.showTLSChangeWarning = false;
      
      searchEndpointSvc.fetchForCase($scope.caseNo)
       .then(function() {
         $scope.searchEndpoints = searchEndpointSvc.searchEndpoints;               
       });      
      
      $scope.listSearchEndpoints = function() {
        return $scope.searchEndpoints;
      };
      
      $scope.createRunCaseInBackgroundLink = function(caseNo, tryNo) {
        let link = caseTryNavSvc.getQuepidRootUrl() + '/home/run_case_evaluation_job/' + caseNo + '?try_number=' + tryNo;
        return link;
      };
      
      $scope.createSearchEndpointLink = function(searchEndpointId) {
        return caseTryNavSvc.createSearchEndpointLink(searchEndpointId);
      };
      

      $scope.validateSearchEngineUrl  = function() {
        if (!angular.isUndefined($scope.settings.searchUrl)){
          if ($scope.settings.searchEngine === 'es' || $scope.settings.searchEngine === 'os'){
            try {
              const args = JSON.parse($scope.settings.queryParams);
              $scope.showESTemplateWarning = esUrlSvc.isTemplateCall(args);
            }
            catch (error){
              // Ignore if we don't have valid JSON in queryParams.
            }
          }

          if ($scope.settings.searchEngine !== '' && !angular.isUndefined($scope.settings.searchUrl)){
            if ($scope.settings.proxyRequests === true){
              $scope.showTLSChangeWarning = false;
            }
            else {
             $scope.showTLSChangeWarning = caseTryNavSvc.needToRedirectQuepidProtocol($scope.settings.searchUrl);
            }

            if ($scope.showTLSChangeWarning){

              var resultsTuple = caseTryNavSvc.swapQuepidUrlTLS();

              $scope.quepidUrlToSwitchTo = resultsTuple[0];
              $scope.protocolToSwitchTo = resultsTuple[1];

              $scope.quepidUrlToSwitchTo = caseTryNavSvc.appendQueryParams($scope.quepidUrlToSwitchTo, 'searchEngine=' + $scope.settings.searchEngine + '&searchUrl=' + $scope.settings.searchUrl + '&showWizard=false&apiMethod=' + $scope.settings.apiMethod);
              $scope.quepidUrlToSwitchTo = $scope.quepidUrlToSwitchTo + '&fieldSpec=' + $scope.settings.fieldSpec;
            }
          }
        }
      };

      $scope.validateQueryParams = function () {
        var commonSolrParamTypos = {
          deftype:               'defType',
          echoparams:            'echoParams',
          explainother:          'explainOther',
          logparamslist:         'logParamsList',
          omitheader:            'omitHeader',
          segmentterminateearly: 'segmentTerminateEarly',
          timeallowed:           'timeAllowed',
        };

        $scope.showQueryParamsWarning = false;

        for (var key in commonSolrParamTypos) {
          var correct = commonSolrParamTypos[key];
          var re      = new RegExp(key);

          if ( $scope.settings.selectedTry.queryParams.match(re) ) {
            $scope.queryParamsWarning = 'Your query params contain <code>' + key + '</code>, you probably meant <code>' + correct + '</code>.';
            $scope.showQueryParamsWarning = true;
            break;
          }
        }
      };

      $scope.qp.toggleTab = function(a) {
        $scope.qp.curTab = a;

        // For some reason when we call `updateVars()` on the original
        // try the `queryParams` attribute does not maintain its new value
        // and reverts to the old value.
        // So instead we are creating a tmp variable to use.
        // UGH, this temp requires mapping back to API format of the data!
        // If you change here, then change TryFactory code too
        var tmp = new TryFactory({
          args:           $scope.settings.selectedTry.args,
          curator_vars:   $scope.settings.selectedTry.curatorVarsDict(),
          escape_query:   $scope.settings.selectedTry.escapeQuery,
          api_method:     $scope.settings.selectedTry.apiMethod,
          custom_headers: $scope.settings.selectedTry.customHeaders,
          field_spec:     $scope.settings.selectedTry.fieldSpec,
          name:           $scope.settings.selectedTry.name,
          number_of_rows: $scope.settings.selectedTry.numberOfRows,
          query_params:   $scope.settings.selectedTry.queryParams,
          search_endpoint_id:  $scope.settings.selectedTry.searchEndpointId,
          endpoint_name:  $scope.settings.selectedTry.endpointName,
          search_engine:  $scope.settings.selectedTry.searchEngine,
          search_url:     $scope.settings.selectedTry.searchUrl,
          try_number:     $scope.settings.selectedTry.tryNo,
          basic_auth_crendential:     $scope.settings.selectedTry.basicAuthCredential,
          options:        $scope.settings.selectedTry.options,
          snapshot_id:  $scope.settings.selectedTry.snapshotId,
        });
        tmp.updateVars();
        
        var searchEndpointToUse = searchEndpointSvc.searchEndpoints.find(obj => obj.id === $scope.settings.searchEndpointId);
        
        $scope.selectedItem = searchEndpointToUse;
        
        $scope.settings.selectedTry = tmp;
        $scope.validateSearchEngineUrl();
      };

      // We currently have two ways of picking an endpoint, one using a straight up SELECT
      // and the other with a fancier UI.  Trying to figure out which is the right one ;-).
      $scope.onSelectSearchEndpoint = function (selectedItem) {
        $scope.settings.searchEndpointId = selectedItem.id;
      };
      
      $scope.searchOptions = function (searchText) {
        // Perform filtering based on search text
        return $scope.searchEndpoints.filter(function (result) {
          return result.name.toLowerCase().indexOf(searchText.toLowerCase()) !== -1;
        });
      };
     
      
      $scope.changeSearchEngine = function() {
        var searchEndpointToUse = $scope.searchEndpoints.find(obj => obj.id === $scope.settings.searchEndpointId);
        
        // Update our settings with the new searchEndpoint values
        $scope.settings.searchEndpoint           = searchEndpointToUse;
        $scope.settings.searchEndpointId         = searchEndpointToUse.id;
        $scope.settings.searchEngine             = searchEndpointToUse.searchEngine;
        $scope.settings.searchUrl                = searchEndpointToUse.endpointUrl; // notice remapping
        $scope.settings.apiMethod                = searchEndpointToUse.apiMethod;
        $scope.settings.customHeaders            = searchEndpointToUse.customHeaders;
        
        // The remaining settings remain the same from before, which means you can get a weird situation
        // where you then need to fix the fields or the query params.
        // This is different from the wizard where we have default values that we plop in for
        // the fields and query params.
               
        $scope.settings.reset();
        $scope.validateSearchEngineUrl();
      };
            
    }
  ]);
