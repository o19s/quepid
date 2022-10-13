'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('QueriesPerformanceCtrl', [
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
          templateUrl:  'queries_performance/_modal.html',
          controller:   'QueriesPerformanceModalInstanceCtrl',
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
          function () {
          },
          function() {
            $log.info('INFO: Modal dismissed');
          }
        );

      }
    }
  ]);
