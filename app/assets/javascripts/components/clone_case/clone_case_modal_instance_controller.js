'use strict';

angular.module('QuepidApp')
  .controller('CloneCaseModalInstanceCtrl', [
    '$quepidModalInstance',
    'theCase',
    function ($quepidModalInstance, theCase) {
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
        $quepidModalInstance.close(ctrl.options);
      };

      ctrl.cancel = function () {
        $quepidModalInstance.dismiss('cancel');
      };
    }
  ]);
