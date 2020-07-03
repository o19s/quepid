'use strict';

angular.module('QuepidApp')
  .controller('QueryNotesCtrl', [
    '$scope',
    'flash',
    function ($scope, flash) {
      $scope.queryNotes = '';

      $scope.$watch('displayed.notes', function() {
        if($scope.displayed.notes) {
          $scope.query.fetchNotes()
            .then(function() {
              $scope.queryNotes = $scope.query.notes;
            }
          );
        }
      });

      $scope.saveNotes = function() {
        $scope.query.saveNotes($scope.queryNotes)
          .then( function() {
            flash.success = 'Success! Your note has been saved.';
            $scope.displayed.notes = false;
          }, function() {
            flash.error = 'Ooooops! Could not save your note. Please try again.';
          });
      };
    }
  ]);
