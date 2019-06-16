'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ScorerListingCtrl', [
    '$window',
    '$scope',
    'flash',
    'customScorerSvc',
    function (
      $window,
      $scope,
      flash,
      customScorerSvc
    ) {
      var ctrl = this;

      ctrl.scorer = $scope.scorer;
      ctrl.light  = $scope.light;

      if ( ctrl.light ) {
        ctrl.colWidth = {
          name:       'col-xs-1',
          code:       'col-xs-7',
          label:      'col-xs-2',
          max_score:  'col-xs-2',
          owner:      '',
        };
      } else {
        ctrl.colWidth = {
          name:       'col-xs-1',
          code:       'col-xs-5',
          label:      'col-xs-2',
          max_score:  'col-xs-2',
          owner:      'col-xs-2',
        };
      }

      // Functions
      ctrl.deleteScorer = deleteScorer;

      function deleteScorer() {
        var deleteScorer = $window.confirm('Are you absolutely sure you want to delete?');

        if (deleteScorer) {
          customScorerSvc.delete(ctrl.scorer)
            .then(function() {
              flash.success = 'Scorer deleted successfully';
            },
            function(response) {
              flash.error = response.data.error;
            });
        }
      }
    }
  ]);
