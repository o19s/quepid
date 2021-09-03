'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('QueryExplainCtrl', [
    '$uibModal',
    '$scope',
    function (
      $uibModal,
      $scope
    ) {
      var ctrl  = this;
      ctrl.query = $scope.query;

      // Functions
      ctrl.prompt = prompt;

      function prompt() {
        var modalInstance = $uibModal.open({
          templateUrl:  'query_explain/_modal.html',
          controller:   'QueryExplainModalInstanceCtrl',
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
