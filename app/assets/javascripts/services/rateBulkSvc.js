'use strict';

angular.module('QuepidApp')
  .service('rateBulkSvc', [
    function rateBulkSvc() {
      var setScale = function(src, dst) {

        if (!angular.isUndefined(src.query)) {
          var scorer = src.query.effectiveScorer();
          if (angular.isUndefined(scorer) || scorer === null || scorer.scorerId === 'default') {
            dst.scale  = {
              '1':  '#c51800',
              '2':  '#e61f00',
              '3':  '#fe2400',
              '4':  '#fe5b00',
              '5':  '#ffad00',
              '6':  '#ffd600',
              '7':  '#bfd200',
              '8':  '#00c700',
              '9':  '#00af00',
              '10': '#008900'
            };
          } else {
            dst.scale = scorer.getColors();
          }
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
