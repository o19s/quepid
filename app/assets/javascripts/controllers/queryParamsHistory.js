'use strict';

angular.module('QuepidApp')
  .controller('queryParamsHistoryCtrl', [
    '$scope', '$uibModal',
    'flash',
    'caseTryNavSvc',
    function($scope, $uibModal, flash, caseTryNavSvc) {
      var urlsIveSeen = {};

      // This method trys to group search urls into names.
      // we use this to do some colour grouping in the history view by engine
      // and we use it to name the engine.  Eventually we will name our engines
      // and this can go away.
      // There is a known bug that after running the wizard, we have TWO tries, one
      // with a null url, and one that is actually from what you defined in the Wizard.
      $scope.urlBucket = function(url, numBuckets) {
        urlsIveSeen[url] = 0;
        var allUrls = Object.keys(urlsIveSeen);
        var idx = 0;
        var foundAt = 0;
        angular.forEach(allUrls, function(otherUrl) {
          if (url === otherUrl) {
            foundAt = idx;
          }
          idx++;
        });
        return foundAt % numBuckets;
      };

      $scope.navigateToTry = function(aTry) {
        caseTryNavSvc.navigateTo({tryNo: aTry.tryNo});
      };
      $scope.curatorVarsString = function(aTry) {
        var rVal = '';
        angular.forEach(aTry.curatorVars, function(cv) {
          rVal += cv.name + '=' + cv.value + '\n';
        });
        return rVal;
      };

      $scope.titleString = function(aTry) {
        var cvStr = $scope.curatorVarsString(aTry);
        return aTry.searchUrl + '\n' + cvStr;
      };

      $scope.tryDetails = function(aTry) {
        var modalInstance = $uibModal.open({
          templateUrl: 'views/queryParamsDetails.html',
          controller: 'QueryParamsDetailsCtrl',
          windowClass: 'queryParamsDetails',
          resolve: {
            aTry: function() {
              return aTry;
            }
          }
        });

        modalInstance.result.then(function (data) {
          if (data && data.action === 'clone') {
            $scope.settings.duplicateTry(data.aTry.tryNo)
              .then(function() {
                flash.success = 'Try duplicated successfully.';
              }, function() {
                flash.error = 'Unable to duplicate try.';
              });
          }
        });
      };
    }
  ]);
