'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('FrogReportCtrl', [
    '$uibModal',
    '$rootScope',
    '$log',
    'flash',
    'caseSvc',
    'queriesSvc',
    function (
      $uibModal,
      $rootScope,
      $log,
      flash,
      caseSvc,
      queriesSvc
    ) {
      var ctrl = this;

      // Functions
      ctrl.prompt     = prompt;


      function prompt() {
        var modalInstance = $uibModal.open({
          templateUrl:  'frog_report/_modal.html',
          controller:   'FrogReportModalInstanceCtrl',
          controllerAs: 'ctrl',
          size: 'lg',
          resolve:      {
            theCase: function() {
              return caseSvc.getSelectedCase();
            },
            queriesSvc: function() {
              return queriesSvc;
            }
          }
        });

        modalInstance.result.then(
          function(error) {
            if ( !error ) {
              queriesSvc.reset();
              queriesSvc.bootstrapQueries(caseSvc.getSelectedCase().caseNo)
                .then(function() {
                  queriesSvc.searchAll();
                });

              flash.success = 'Ratings refreshed successfully!';
            } else {
              flash.error = error;
            }
          }, function() { }
        );


      }
    }
  ]);
