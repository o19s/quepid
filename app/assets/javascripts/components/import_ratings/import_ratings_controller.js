'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ImportRatingsCtrl', [
    '$scope',
    '$uibModal',
    'flash',
    'caseSvc',
    'queriesSvc',
    'querySnapshotSvc',
    function($scope, $uibModal, flash, caseSvc, queriesSvc, querySnapshotSvc) {
      var ctrl = this;

      // Functions
      ctrl.create = create;

      function create () {
        var modalInstance = $uibModal.open({
          templateUrl:  'import_ratings/_modal.html',
          controller:   'ImportRatingsModalInstanceCtrl',
          controllerAs: 'ctrl',
          size: 'lg',
          resolve:      {
            theCase: function() {
              return caseSvc.getSelectedCase(); //TODO not sure why this is needed for import snapshot to work?
            },
            querySnapshotSvc: function() {
              return querySnapshotSvc;
            },
            flash: function() {
              return flash;
            },
            queriesSvc: function() {
              return flash;
            }
          }
        });

        modalInstance.result.then(
          function(response) {
            if ( !response.error ) {
              queriesSvc.reset();
              queriesSvc.bootstrapQueries(ctrl.acase.caseNo)
                  .then(function() {
                    queriesSvc.searchAll();
                  });

              flash.success = response.message;
            } else {
              flash.error = response.message;
            }
          }, function() { }
        );
      }
    }
  ]);
