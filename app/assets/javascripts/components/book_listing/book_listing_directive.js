'use strict';

angular.module('QuepidApp')
  .directive('bookListing', [
    function () {
      return {
        restrict:     'E',
        controller:   'BookListingCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'book_listing/book_listing.html',
        scope:        {
          book: '=',
          team:   '=',
        },
      };
    }
  ]);
