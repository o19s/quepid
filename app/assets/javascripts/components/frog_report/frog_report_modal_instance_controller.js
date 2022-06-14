'use strict';

angular.module('QuepidApp')
  .controller('FrogReportModalInstanceCtrl', [
    '$uibModalInstance',
    'theCase', 'queriesSvc',
    function ($uibModalInstance, theCase, queriesSvc) {
      var ctrl = this;

      ctrl.theCase = theCase;
      ctrl.queriesSvc = queriesSvc
      ctrl.options = {
        history:  false,
        queries:  true,
        ratings:  false,
        caseName: ''
      };

      ctrl.numberOfMissingRatings = function() {
        var countMissingRatings = 0;
        angular.forEach(queriesSvc.queries, function(q) {
          countMissingRatings = countMissingRatings + q.currentScore.countMissingRatings;
        });

        return countMissingRatings;
      }

      ctrl.numberOfRatings = function() {
        var countRatings = 0;
        angular.forEach(queriesSvc.queries, function(q) {
          countRatings = countRatings + Object.keys(q.ratings).length;

        });

        return countRatings;
      }

      ctrl.cannotClone = function() {
        return !ctrl.options.caseName || ctrl.options.caseName === '';
      };

      ctrl.ok = function () {
        $uibModalInstance.close(ctrl.options);
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
