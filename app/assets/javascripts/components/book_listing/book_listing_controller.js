'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('BookListingCtrl', [
    '$scope',
    function (
      $scope
    ) {
      var ctrl = this;
      ctrl.book = $scope.book;
      ctrl.team  = $scope.team;

      // Functions
      function goToCase() {
        caseTryNavSvc.navigateTo({'caseNo': ctrl.thisCase.caseNo, 'tryNo': ctrl.thisCase.lastTry});
      }      

    }
  ]);
