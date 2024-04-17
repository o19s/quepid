'use strict';
/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('QueriesStrippedCtrl', [
    '$scope',    
    'queriesSvc',    
    'querySnapshotSvc',
    'caseSvc',
    function (
      $scope,     
      queriesSvc,   
      querySnapshotSvc,
      caseSvc
    ) {
      $scope.queriesSvc = queriesSvc;
      $scope.caseSvc = caseSvc;

      $scope.queries                  = {};

      $scope.queries.queriesChanged = function() {
        return queriesSvc.version();
      };


      // get all the queries for this case for the query service
      $scope.queriesList = [];
      $scope.$watch(function(){
        // only call if the query service has new information!
        return queriesSvc.version();
      }, function(){
        $scope.queriesList = queriesSvc.queryArray();
        updateBatchInfo();
      });
      
      $scope.snapshotPayload = function() {
        if (!$scope.searching()){
          return querySnapshotSvc.createSnapshotPayload('', true, false, queriesSvc.queryArray());
        }
      };

      $scope.searching = function() {
        return queriesSvc.hasUnscoredQueries();
      };
      $scope.batchPosition = 0;
      $scope.batchSize = 0;
      function getBatchPosition() {
        return queriesSvc.scoredQueryCount();
      }

      function updateBatchInfo() {
        $scope.batchSize = queriesSvc.queryCount();
        $scope.batchPosition = queriesSvc.scoredQueryCount();
      }
      $scope.$watch(getBatchPosition, updateBatchInfo);

     

    }
  ]);
