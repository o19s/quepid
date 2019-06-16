'use strict';

angular.module('QuepidApp')
  .directive('expandContent', [
    function() {
      return {
        restrict:     'E',
        controller:   'ExpandContentCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'expand_content/expand_content.html',
        scope:        {
          content: '=',
          title:   '=',
        },
      };
    }
  ]);
