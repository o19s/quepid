'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('QueryAnalyticsCtrl', [
    '$scope',
    '$uibModal',
    'flash',
    function (
      $scope,
      $uibModal,
      flash
    ) {
      var ctrl = this;

      ctrl.thisQuery       = $scope.thisQuery;
      ctrl.varianceColour  = varianceColour;

      function varianceColour() {
        var colour = '';
        var val = ctrl.thisQuery.ratingVariance;
        switch(true)
        {
            case ((val >= 0) && (val <= .33)):
                colour = 'Tomato';
                break;
            case ((val >= .34) && (val <= .79)):
                colour = '#dbab09';
                break;
            case ((val >= .8) && (val <= 1)):
                colour = 'SeaGreen';
                break;
        }
        return colour;
      }
    }
  ]);
