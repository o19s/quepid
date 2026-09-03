'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('BrowseQueryCtrl', [
    '$quepidModal',
    '$scope',
    function (
      $quepidModal,
      $scope
    ) {
      var ctrl = this;
      ctrl.query = $scope.query;
      ctrl.selectedTry = $scope.selectedTry;

      // 'solr' is the only built-in engine offering this today; every other engine
      // (Vespa, a plain Custom Search API endpoint, ...) goes through 'searchapi',
      // differentiated only by mapperBasedSearchEngineName (see TryFactory.js).
      ctrl.engineName = ctrl.selectedTry.searchEngine === 'solr' ?
        'Solr' :
        (ctrl.selectedTry.mapperBasedSearchEngineName || 'Search API');

      ctrl.prompt = prompt;

      function prompt() {
        var modalInstance = $quepidModal.open({
          templateUrl:      'browse_query/_modal.html',
          ariaLabelledBy:   'browse-query-modal-title',
          controller:       'BrowseQueryModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve: {
            query: function() { return ctrl.query; },
            selectedTry: function() { return ctrl.selectedTry; },
            engineName: function() { return ctrl.engineName; }
          }
        });

        modalInstance.result.then(
          function() { },
          function() { }
        );
      }
    }
  ]);
