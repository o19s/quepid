'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('FrogReportCtrl', [
    '$quepidModal',
    'flash',
    'caseSvc',
    'queriesSvc',
    function (
      $quepidModal,
      flash,
      caseSvc,
      queriesSvc
    ) {
      var ctrl = this;

      // Functions
      ctrl.prompt     = prompt;


      function prompt() {
        var modalInstance = $quepidModal.open({
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
