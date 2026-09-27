'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('JudgementsCtrl', [
    '$quepidModal',
    'queriesSvc',
    function (
      $quepidModal,
      queriesSvc
    ) {
      var ctrl = this;

      // Functions
      ctrl.prompt = prompt;

      function prompt() {
        var modalInstance = $quepidModal.open({
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

              window.quepidDom.flash.show('success', 'Ratings refreshed successfully!');
            }
          }, function() { }
        );
      }
    }
  ]);
