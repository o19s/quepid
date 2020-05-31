'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ImportRatingsCtrl', [
    '$scope',
    '$uibModal',
    'flash',
    'caseSvc',
    'queriesSvc',
    function($scope, $uibModal, flash, caseSvc, queriesSvc) {
      var ctrl = this;

      // Functions
      ctrl.create = create;

      function create () {
        var modalInstance = $uibModal.open({
          templateUrl:  'import_ratings/_modal.html',
          controller:   'ImportRatingsModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve:      {
            theCase: function() {
              return ctrl.acase;
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
