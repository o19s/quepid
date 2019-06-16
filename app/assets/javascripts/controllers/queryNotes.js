'use strict';

angular.module('QuepidApp')
  .controller('QueryNotesCtrl', [
    '$scope',
    'flash',
    '$timeout',
    function ($scope, flash, $timeout) {
      var ctrl  = this;
      ctrl.saveInProgress = false;
      $scope.queryNotes = ''; // need this?
      var timeout = null;

      var saveFinished = function() {
        ctrl.saveInProgress = false;
      };
      var saveNotes = function() {

        $scope.query.saveNotes($scope.displayNotes)
          .then( function() {

          }, function() {
            flash.error = 'Ooooops! Could not save your note.';
          }).finally(saveFinished);
      };
      var debounceSaveUpdates = function(newVal, oldVal) {
        if (newVal !== oldVal) {
          if (!ctrl.saveInProgress) {
            ctrl.saveInProgress = true;
            if (timeout) {
              $timeout.cancel(timeout);
            }
            timeout = $timeout(saveNotes, 1000);  // 1000 = 1 second
          }
        }
      };

      $scope.$watch('displayNotes', debounceSaveUpdates);


    }
  ]);
