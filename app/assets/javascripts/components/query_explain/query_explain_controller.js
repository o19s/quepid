'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('QueryExplainCtrl', [
    '$quepidModal',
    '$scope',
    function (
      $quepidModal,
      $scope
    ) {
      var ctrl  = this;
      ctrl.query = $scope.query;

      // Functions
      ctrl.prompt = prompt;

      function prompt() {
        var modalInstance = $quepidModal.open({
          templateUrl:      'query_explain/_modal.html',
          ariaLabelledBy:   'query-explain-modal-title',
          controller:       'QueryExplainModalInstanceCtrl',
          controllerAs: 'ctrl',
          size: 'lg',
          resolve: {
            query: function() { return ctrl.query; }
          }
        });

        modalInstance.result.then(
          function() { },
          function() { }
        );
      }
    }
  ]);
