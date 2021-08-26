'use strict';

angular.module('QuepidApp')
  .controller('QueryParamsCtrl', [
    '$scope',
    'esUrlSvc',
    'TryFactory',
    function ($scope, esUrlSvc, TryFactory) {

      $scope.qp = {};
      $scope.qp.curTab = 'developer';

      $scope.showQueryParamsWarning = false;
      $scope.queryParamsWarning = '';

      $scope.showESTemplateWarning = false;

      $scope.validateESTemplateUrl  = function() {
        if ($scope.settings.searchEngine === 'es'){
          var uri       = esUrlSvc.parseUrl($scope.settings.searchUrl);
          $scope.showESTemplateWarning = esUrlSvc.isTemplateCall(uri);
        }
      }




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
        var tmp = new TryFactory({
          args:           $scope.settings.selectedTry.args,
          curatorVars:    $scope.settings.selectedTry.curatorVarsDict(),
          escape_query:   $scope.settings.selectedTry.escapeQuery,
          field_spec:     $scope.settings.selectedTry.fieldSpec,
          name:           $scope.settings.selectedTry.name,
          numberOfRows:   $scope.settings.selectedTry.numberOfRows,
          query_params:   $scope.settings.selectedTry.queryParams,
          search_engine:  $scope.settings.selectedTry.searchEngine,
          search_url:     $scope.settings.selectedTry.searchUrl,
          try_number:     $scope.settings.selectedTry.tryNo,
        });
        tmp.updateVars();
        $scope.settings.selectedTry = tmp;
        $scope.validateESTemplateUrl();
      };


    }
  ]);
