'use strict';

angular.module('QuepidApp')
  .directive('archiveCase', [
    function () {
      return {
        restrict:     'E',
        controller:   'ArchiveCaseCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'archive_case/archive_case.html',
        scope:        {
          thisCase: '=',
        },
      };
    }
  ]);
