'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('QuepidApp')
    .service('scorerControllerActionsSvc', [
      function() {
        var self = this;

        var scaleOptions = {
          defaultScale:   '1, 2, 3, 4, 5, 6, 7, 8, 9, 10',
          shortScale:     '1, 2, 3, 4',
          fibonacciScale: '1, 2, 3, 5, 8, 13, 21, 34',
          custom:         '',
        };

        // Functions
        self.addActions = addActions;

        function addActions(ctrl, scope) {
          ctrl.scaleOptions = scaleOptions;

          scope.$watch('ctrl.scorer.scale', function() {
            ctrl.updateScale(ctrl.scorer.scale);
          });

          ctrl.updateScale = function(scale) {
            if ( scale !== ctrl.scorer.scale) {
              ctrl.scorer.scale            = scale;
              ctrl.scorer.scaleWithLabels  = ctrl.scorer.scaleToScaleWithLabels(ctrl.scorer.scale, ctrl.scorer.scaleWithLabels);
            }
          };
        }
      }
    ]);
})();
