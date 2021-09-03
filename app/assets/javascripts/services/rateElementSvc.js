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

      var handleRatingScale = function(src, rateCallback, resetCallback, extra) {
        src.ratingsOn = false;

        src.open = function() {
          src.ratingsOn = true;
        };

        src.close = function() {
          src.ratingsOn = false;
        };

        src.rate = function(ratingNo) {
          rateCallback(ratingNo, extra);
          src.close();
        };

        src.reset = function() {
          resetCallback(extra);
          src.close();
        };
      };

      this.setScale           = setScale;
      this.handleRatingScale  = handleRatingScale;
    }
  ]);
