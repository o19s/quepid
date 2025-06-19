'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('BookListingCtrl', [
    '$scope', 'caseTryNavSvc',
    function (
      $scope, caseTryNavSvc
    ) {
      var ctrl = this;
      ctrl.book = $scope.book;
      ctrl.team  = $scope.team;
      
      $scope.createBookLink = function(bookId) {
        let link = caseTryNavSvc.getQuepidRootUrl() + '/books/' + bookId;
        link = caseTryNavSvc.createMainApplicationLink(link);
        return link;
      };

      // Functions    

    }
  ]);
