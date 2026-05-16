'use strict';

/*jshint latedef:false */

angular.module('QuepidApp')
  .controller('DebugMatchesCtrl', [
    '$quepidModal',
    function (
      $quepidModal
    ) {
      var ctrl = this;

      // Functions
      ctrl.showDetailed = showDetailed;

      function showDetailed() {
        $quepidModal.open({
          templateUrl:  'debug_matches/_modal.html',
          controller:   'DebugMatchesModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve: {
            doc: function() {
              return ctrl.doc;
            },
            maxScore: function() {
              return ctrl.maxDocScore;
            }
          },
          windowClass:  'doc-detailed-explain-modal',
        });
      }
    }
  ]);
