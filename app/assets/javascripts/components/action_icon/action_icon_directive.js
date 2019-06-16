'use strict';

angular.module('QuepidApp')
  .directive('actionIcon', [
    function () {
      return {
        restrict:     'E',
        controller:   'ActionIconCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'action_icon/action_icon.html',
        scope:        {
          fnCall:     '&',
          iconClass:  '=',
          title:      '=',
        },
      };
    }
  ]);
