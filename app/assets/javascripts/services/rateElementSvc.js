'use strict';

angular.module('QuepidApp')
  .service('rateElementSvc', [
    function rateElementSvc() {
      var setScale = function(src, dst) {
        if (!angular.isUndefined(src.query)) {
          var scorer = src.query.effectiveScorer();
          dst.scale = scorer.getColors();
        }
      };

      this.setScale = setScale;
    }
  ]);
