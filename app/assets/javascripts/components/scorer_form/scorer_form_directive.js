'use strict';

angular.module('QuepidApp')
  .directive('scorerForm', [
    function () {
      return {
        restrict:         'E',
        scope:            true,
        controller:       'ScorerFormCtrl',
        controllerAs:     'formCtrl',
        templateUrl:      'scorer_form/scorer_form.html',
      };
    }
  ]);
