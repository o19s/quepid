'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('DeleteCaseOptionsCtrl', [
    '$uibModal',
    '$rootScope',
    '$log',
    'flash',
    'caseSvc',
    'caseTryNavSvc',
    function (
      $uibModal,
      $rootScope,
      $log,
      flash,
      caseSvc,
      caseTryNavSvc
    ) {
      var ctrl = this;

      // Functions
      ctrl.deleteCase  = deleteCase;
      ctrl.archiveCase  = archiveCase;
      ctrl.deleteCaseQueries = deleteCaseQueries;
      ctrl.prompt     = prompt;

      function deleteCase() {
        caseSvc.deleteCase(ctrl.acase).then(
          function () {
            flash.success = 'Case deleted successfully.';
            caseTryNavSvc.navigateToCasesListing();
          }, function (data) {
            var message = 'Oooops! Could not delete the case. ';
            message += data.message;
            flash.error = message;
          }
        );
      }

      function archiveCase() {
        caseSvc.archiveCase(ctrl.acase).then(
          function () {
            flash.success = 'Case archived successfully.';
            caseTryNavSvc.navigateToCasesListing();
          }, function (data) {
            var message = 'Oooops! Could not archive the case. ';
            message += data.message;
            flash.error = message;
          }
        );
      }

      function deleteCaseQueries() {
        caseSvc.deleteCaseQueries(ctrl.acase).then(
          function () {
            flash.success = 'Case queries all deleted.';
            caseTryNavSvc.navigateTo({'caseNo': ctrl.acase.caseNo, 'tryNo': ctrl.acase.lastTry});
          }, function (data) {
            var message = 'Oooops! Could not delete all the queries for this case. ';
            message += data.message;
            flash.error = message;
          }
        );
      }

      function prompt() {

        var modalInstance = $uibModal.open({
          templateUrl:  'delete_case_options/_modal.html',
          controller:   'DeleteCaseOptionsModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve:      {
            theCase: function() {
              return ctrl.acase;
            }
          }
        });

        modalInstance.result.then(
          function (options) {
            switch(options.action) {
              case 'delete_all_queries':
                ctrl.deleteCaseQueries();
                break;
              case 'archive_case':
                ctrl.archiveCase();
                break;
              case 'delete_case':
                ctrl.deleteCase();
                break;

            }
          },
          function() {
            $log.info('INFO: Modal dismissed');
          }
        );

      }
    }
  ]);
