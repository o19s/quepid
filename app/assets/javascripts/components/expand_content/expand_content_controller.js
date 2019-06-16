'use strict';

/*jshint latedef:false */

angular.module('QuepidApp')
  .controller('ExpandContentCtrl', [
    '$scope',
    '$sce',
    '$uibModal',
    function (
      $scope,
      $sce,
      $uibModal
    ) {
      var ctrl = this;
      ctrl.content = $scope.content;
      ctrl.title   = $scope.title;

      // Functions
      ctrl.expand = expand;

      function expand() {
        $uibModal.open({
          templateUrl:  'expand_content/_modal.html',
          controller:   'ExpandContentModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve: {
            content: function() {
              return $sce.trustAsHtml(ctrl.content);
            },
            title: function() {
              return $sce.trustAsHtml(ctrl.title);
            },
          },
          windowClass:  'full-screen-modal',
        });
      }
    }
  ]);
