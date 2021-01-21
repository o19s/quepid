'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('CaseAnalyticsCtrl', [
    '$scope',
    '$uibModal',
    'flash',
    'caseSvc',
    function (
      $scope,
      $uibModal,
      flash,
      caseSvc
    ) {
      var ctrl = this;

      ctrl.thisCase         = $scope.thisCase;
      ctrl.varianceColour  = varianceColour;

      function varianceColour() {
        var colour = '';
        var val = ctrl.thisCase.caseRatingVariance;
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
