'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ImportRatingsCtrl', [
    '$quepidModal',
    'queriesSvc',
    'querySnapshotSvc',
    function ($quepidModal, queriesSvc, querySnapshotSvc) {
      var ctrl = this;

      // Functions
      ctrl.create = create;

      function create() {
        var modalInstance = $quepidModal.open({
          templateUrl: 'import_ratings/_modal.html',
          controller: 'ImportRatingsModalInstanceCtrl',
          controllerAs: 'ctrl',
          size: 'lg',
          resolve: {
            theCase: function () {
              return ctrl.acase;
            },
            querySnapshotSvc: function () {
              return querySnapshotSvc;
            },
            queriesSvc: function () {
              return queriesSvc;
            }
          }
        });

        modalInstance.result.then(
          function (response) {
            if (!response.error) {
              if (response.message !== 'Snapshots imported successfully!') {
                queriesSvc.reset();
                queriesSvc.bootstrapQueries(ctrl.acase.caseNo)
                  .then(function () {
                    queriesSvc.searchAll();
                  });
              }

              window.quepidDom.flash.show('success', response.message);
            } else {
              window.quepidDom.flash.show('error', response.message);
            }
          }, function () {
          }
        );
      }
    }
  ]);
