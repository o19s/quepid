'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('MoveQueryModalInstanceCtrl', [
    '$scope',
    '$quepidModalInstance',
    'broadcastSvc',
    'caseSvc',
    'query',
    function(
      $scope,
      $quepidModalInstance,
      broadcastSvc,
      caseSvc,
      query
    ) {
      var ctrl = this;

      // Attributes
      ctrl.activeCase = null;
      ctrl.cases      = caseSvc.allCases.slice();
      ctrl.loading    = false;

      // Init
      if ( angular.isUndefined(ctrl.cases) || ctrl.cases.length === 0 ) {
        fetchCaseList();
      }

      var events = [
        'bootstrapped',
        'caseRenamed',
        'deepCaseListUpdated',
        'settings-updated',
        'updatedCaseScore',
        'updatedCasesList',
      ];
      angular.forEach(events, function (eventName) {
        $scope.$on(eventName, function() {
          ctrl._internalCaseList = caseSvc.allCases;
          getLists();
        });
      });

      $scope.$watchCollection('_internalCaseList', function() {
        getLists();
      });

      // Functions
      ctrl.cancel     = cancel;
      ctrl.ok         = ok;
      ctrl.selectCase = selectCase;

      function cancel () {
        $quepidModalInstance.dismiss('cancel');
      }

      function fetchCaseList () {
        ctrl.loading = true;
        caseSvc.getCases()
          .then(function() {
            ctrl.loading = false;
            broadcastSvc.send('updatedCasesList', caseSvc.allCases);
          });
      }

      function getLists () {
        ctrl.cases = caseSvc.allCases.slice();

        // remove the current case
        ctrl.cases = ctrl.cases.filter(function(e) {
          return query.caseNo !== e.caseNo;
        });
      }

      function ok () {
        $quepidModalInstance.close(ctrl.activeCase);
      }

      function selectCase (activeCase) {
        ctrl.activeCase = activeCase;
      }
    }
  ]);
