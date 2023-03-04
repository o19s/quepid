'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('CaseListingCtrl', [
    '$rootScope',
    '$scope',
    '$location',
    'flash',
    'caseTryNavSvc',
    'caseSvc',
    function (
      $rootScope,
      $scope,
      $location,
      flash,
      caseTryNavSvc,
      caseSvc
    ) {
      var ctrl = this;

      ctrl.thisCase    = $scope.thisCase;
      ctrl.clickToEdit = {};
      ctrl.clickToEdit.oldVal   = ctrl.thisCase.caseName.slice(0);
      ctrl.clickToEdit.currVal  = ctrl.thisCase.caseName.slice(0);
      ctrl.clickToEdit.clicked  = false;
      ctrl.canUpdate = false;

      // Functions
      ctrl.cancel     = cancel;
      ctrl.goToCase   = goToCase;
      ctrl.rename     = rename;
      ctrl.submit     = submit;
      ctrl.goToTeam   = goToTeam;

      function goToTeam(teamId) {
        var path = '/teams/' + teamId;
        $location.path(path);
      };



      $rootScope.$watch('currentUser', function() {
        if ( $rootScope.currentUser ) {
          ctrl.canUpdate = $rootScope.currentUser.permissions.case.update;
        }
      });

      function rename() {
        if (ctrl.canUpdate) {
          ctrl.clickToEdit.clicked = true;
        }
        else {
          flash.error = 'You do not have update permissions for cases.';
        }
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
