'use strict';

/*jshint latedef:false */

angular.module('QuepidApp')
  .controller('ExpandContentCtrl', [
    '$scope',
    '$sce',
    '$quepidModal',
    function (
      $scope,
      $sce,
      $quepidModal
    ) {
      var ctrl = this;
      ctrl.content = $scope.content;
      ctrl.title   = $scope.title;

      // Functions
      ctrl.expand = expand;

      function expand() {
        $quepidModal.open({
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
