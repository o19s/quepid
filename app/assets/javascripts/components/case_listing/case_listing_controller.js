'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('CaseListingCtrl', [
    '$scope',
    'caseTryNavSvc',
    function (
      $scope,
      caseTryNavSvc
    ) {
      var ctrl = this;

      ctrl.thisCase    = $scope.thisCase;
      ctrl.clickToEdit = {};
      ctrl.clickToEdit.oldVal   = ctrl.thisCase.caseName.slice(0);
      ctrl.clickToEdit.currVal  = ctrl.thisCase.caseName.slice(0);
      ctrl.clickToEdit.clicked  = false;

      // Functions
      ctrl.cancel     = cancel;
      ctrl.canExport  = canExport;
      ctrl.goToCase   = goToCase;
      ctrl.rename     = rename;
      ctrl.submit     = submit;

      // we may get bound to different cases on moves, reset the state
      $scope.$watch('thisCase', function() {
        ctrl.thisCase            = $scope.thisCase;
        ctrl.clickToEdit.currVal = ctrl.thisCase.caseName.slice(0);
        ctrl.clickToEdit.clicked = false;
      });

      function rename() {
        ctrl.clickToEdit.clicked = true;
      }

      function cancel() {
        ctrl.clickToEdit.currVal  = ctrl.clickToEdit.oldVal;
        ctrl.thisCase.caseName    = ctrl.clickToEdit.oldVal;
        ctrl.clickToEdit.clicked  = false;
      }

      function goToCase() {
        caseTryNavSvc.navigateTo({'caseNo': ctrl.thisCase.caseNo, 'tryNo': ctrl.thisCase.lastTry});
      }

      function submit() {
        ctrl.clickToEdit.clicked = false;
        if (ctrl.clickToEdit.oldVal !== ctrl.clickToEdit.currVal) {
          ctrl.clickToEdit.oldVal = ctrl.clickToEdit.currVal;
          ctrl.thisCase.rename(ctrl.clickToEdit.currVal);
        }
      }

      function canExport() {
        if (angular.isDefined(ctrl.thisCase.queries) && ctrl.thisCase.queries.length > 0) {
          return  angular.isDefined(ctrl.thisCase.lastScore) &&
                  ctrl.thisCase.lastScore.hasData;
        }
      }
    }
  ]);
