'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('CaseListingCtrl', [
    '$rootScope',
    '$scope',
    '$location',
    'caseTryNavSvc',
    'caseSvc',
    function (
      $rootScope,
      $scope,
      $location,
      caseTryNavSvc,
      caseSvc
    ) {
      var ctrl = this;

      ctrl.thisCase    = $scope.thisCase;
      ctrl.clickToEdit = {};
      ctrl.clickToEdit.oldVal   = ctrl.thisCase.caseName.slice(0);
      ctrl.clickToEdit.currVal  = ctrl.thisCase.caseName.slice(0);
      ctrl.clickToEdit.clicked  = false;

      // Functions
      ctrl.cancel     = cancel;
      ctrl.goToCase   = goToCase;
      ctrl.rename     = rename;
      ctrl.submit     = submit;
      ctrl.goToTeam   = goToTeam;

      function goToTeam(teamId) {
        var path = '/teams/' + teamId;
        $location.path(path);
      }

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
          caseSvc.renameCase(ctrl.thisCase, ctrl.clickToEdit.currVal);
        }
      }
    }
  ]);
