'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('QuepidApp')
    .service('scorerControllerActionsSvc', [
      function() {
        var self = this;

        var scaleOptions = {
          binaryScale:    '0, 1',
          gradedScale:    '0, 1, 2, 3',
          detailScale:    '1, 2, 3, 4, 5, 6, 7, 8, 9, 10',
          custom:         '',
        };

        // Functions
        self.addActions = addActions;

        function addActions(ctrl, scope) {
          ctrl.scaleOptions = scaleOptions;

          // Let's only watch the scale if you pick custom radio option
          scope.$watch('ctrl.scorer.scale', function() {
            if (ctrl.scaleChoice === 'custom') {
              ctrl.updateScale(ctrl.scorer.scale);
            }
          });

          ctrl.updateScale = function(scale) {
            //if ( scale !== ctrl.scorer.scale {
              if (ctrl.needToWarnOnScaleChange) {
                ctrl.updatingScale           = true;
              }
              ctrl.scorer.scale            = scale;
              ctrl.scorer.scaleWithLabels  = ctrl.scorer.scaleToScaleWithLabels(ctrl.scorer.scale, ctrl.scorer.scaleWithLabels);
            //}
          };
        }
      }
    ]);
})();
