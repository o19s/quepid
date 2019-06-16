'use strict';

angular.module('QuepidApp')
  .controller('ExpandContentModalInstanceCtrl', [
    'content', 'title',
    function (content, title) {
      var ctrl = this;

      // Attributes
      ctrl.content = content;
      ctrl.title   = title;
    }
  ]);
