'use strict';

angular.module('QuepidApp')
  .controller('CloneCaseModalInstanceCtrl', [
    '$uibModalInstance',
    'theCase',
    function ($uibModalInstance, theCase) {
      var ctrl = this;

      ctrl.theCase = theCase;
      ctrl.options = {
        history:  false,
        queries:  true,
        ratings:  false,
        tryId:    theCase.lastTry,
        tries:    theCase.tries,
        caseName: ''
      };

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
