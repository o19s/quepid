'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('JudgementsCtrl', [
    '$uibModal',
    'flash',
    'queriesSvc',
    function (
      $uibModal,
      flash,
      queriesSvc
    ) {
      var ctrl = this;

      // Functions
      ctrl.prompt = prompt;

      function prompt() {
        var modalInstance = $uibModal.open({
          templateUrl:  'judgements/_modal.html',
          controller:   'JudgementsModalInstanceCtrl',
          controllerAs: 'ctrl',
          size: 'lg',
          resolve: {
            acase: function() {
              return ctrl.acase;
            }
          }
        });

        modalInstance.result.then(
          function(bootstrapQueries) {
            if ( bootstrapQueries ) {
              queriesSvc.reset();
              queriesSvc.bootstrapQueries(ctrl.acase.caseNo)
                .then(function() {
                  queriesSvc.searchAll();
                });

              flash.success = 'Ratings refreshed successfully!';
            }
          }, function() { }
        );
      }
    }
  ]);
