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
      ctrl.create = create(caseSvc, querySnapshotSvc, flash, queriesSvc);

      function create (caseSvc, querySnapshotSvc, flash, queriesSvc) {
        var modalInstance = $uibModal.open({
          templateUrl:  'import_ratings/_modal.html',
          controller:   'ImportRatingsModalInstanceCtrl',
          controllerAs: 'ctrl',
          size: 'lg',
          resolve:      {
            theCase: function() {
              console.log('caseSvc.getSelectedCase()', caseSvc.getSelectedCase());
              return caseSvc.getSelectedCase();
              //return ctrl.acase;
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
          function(error) {
            if ( !error ) {
              queriesSvc.reset();
              queriesSvc.bootstrapQueries(ctrl.acase.caseNo)
                .then(function() {
                  queriesSvc.searchAll();
                });

              flash.success = 'Ratings imported successfully!';
            } else {
              flash.error = error;
            }
          }, function() { }
        );
      }
    }
  ]);
