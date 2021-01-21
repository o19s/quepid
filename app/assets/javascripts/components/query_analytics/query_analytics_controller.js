'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('QueryAnalyticsCtrl', [
    '$scope',
    function (
      $scope
    ) {
      var ctrl = this;

      ctrl.thisQuery       = $scope.thisQuery;
      ctrl.varianceColour  = varianceColour;

      function varianceColour() {
        var colour = '';
        var val = ctrl.thisQuery.ratingVariance;
        switch(true)
        {
            case ((val >= 0) && (val <= 0.33)):
                colour = 'Tomato';
                break;
            case ((val >= 0.34) && (val <= 0.79)):
                colour = '#dbab09';
                break;
            case ((val >= 0.8) && (val <= 1)):
                colour = 'SeaGreen';
                break;
        }
        return colour;
      }
    }
  ]);
