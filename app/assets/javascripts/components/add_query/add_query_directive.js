'use strict';

angular.module('QuepidApp')
  .directive('addQuery', [
    '$timeout',
    function($timeout) {
      var delim = ';';

      return {
        scope:          true,
        controller:     'AddQueryCtrl',
        controllerAs:   'ctrl',
        templateUrl:    'add_query/add_query.html',
        // Paste on #add-query → ctrl.handlePaste (newlines become semicolons).
        link: function (scope, element) {
          const attach = window.quepidDom && window.quepidDom.textPaste && window.quepidDom.textPaste.attach;
          if (!attach) {
            console.warn('addQuery: window.quepidDom.textPaste not available');
            return;
          }

          const input = element[0].querySelector('#add-query');
          if (!input) { return; }

          const detach = attach(input, function (pastedText) {
            $timeout(function () {
              scope.ctrl.text = pastedText.split('\n').join(delim);
            });
          });

          scope.$on('$destroy', detach);
        }
      };
    }
  ]);
