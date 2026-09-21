'use strict';

/*
 * What is left of CaseCtrl after the case header moved to a server-rendered Rails partial
 * (app/views/core/_case_header.html.erb). Case rename lives there now, as a Turbo Frame.
 *
 * Two call sites still need this controller:
 *   - views/devQueryParams.html declares `ng-controller="CaseCtrl as ctrl"` for the
 *     "evaluate nightly" checkbox, which binds caseModel.selectedCase().nightly and
 *     ng-change="updateNightly()".
 *   - core/_case_toolbar.html.erb keeps it on #case-actions so <import-ratings> can bind
 *     acase="caseModel.selectedCase()".
 *
 * Both go away with the Tune Relevance drawer and <import-ratings>; see
 * docs/todo/angularjs_removal_inventory.md.
 */
angular.module('QuepidApp')
  .controller('CaseCtrl', [
    '$scope',
    'caseSvc',
    function (
      $scope,
      caseSvc
    ) {
      // Returned by selectedCase() before caseSvc has loaded the case. It has to be a single
      // stable instance, not a fresh literal per call: <import-ratings> binds
      // acase="caseModel.selectedCase()" with '=', so a new object identity on every digest is
      // a change on every digest, which aborts the digest with $rootScope:infdig. The Angular
      // template used to hide the toolbar behind ng-if="caseModel.caseLoaded()" until the case
      // arrived, which accidentally kept this placeholder away from the binding; the toolbar is
      // server-rendered now and visible immediately, so the placeholder has to be stable itself.
      var NO_CASE = { caseNo: -1, caseName: '' };

      $scope.caseModel = {};
      $scope.theCase   = caseSvc.getSelectedCase();

      $scope.updateNightly = function () {
        caseSvc.updateNightly($scope.theCase);
      };

      $scope.$watch(function() { return caseSvc.getSelectedCase(); }, function(aCase) {
        if (aCase) {
          $scope.theCase = aCase;
        }
      });

      $scope.caseModel.selectedCase = function() {
        if (caseSvc.isCaseSelected()) {
          return caseSvc.getSelectedCase();
        }
        else {
          return NO_CASE;
        }
      };

      // Gates the server-rendered case toolbar (core/_case_toolbar.html.erb). Its actions reach
      // into live queriesSvc state - "Create snapshot" posts an empty snapshot that never
      // resolves if it is clicked before the case has bootstrapped - so the toolbar stays hidden
      // until the case is loaded, exactly as the Angular template did.
      $scope.caseModel.caseLoaded = function() {
        return $scope.caseModel.selectedCase().caseNo !== -1;
      };
    }
  ]);
