'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('FrogReportCtrl', [
    '$uibModal',
    'flash',
    'caseSvc',
    'queriesSvc',
    function (
      $uibModal,
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
          function() {
            queriesSvc.reset();
            queriesSvc.bootstrapQueries(caseSvc.getSelectedCase().caseNo)
              .then(function() {
                queriesSvc.searchAll();
              });

            flash.success = 'Ratings refreshed successfully!';
          
          }, function() { }
        );


      }
    }
  ]);
