'use strict';

angular.module('QuepidApp')
  .controller('QueryNotesCtrl', [
    '$scope',
    'flash',
    function ($scope, flash) {
      $scope.queryNotes = '';
      $scope.informationNeed = '';

      $scope.$watch('displayed.notes', function() {
        if($scope.displayed.notes) {
          $scope.query.fetchNotes()
            .then(function() {
              $scope.queryNotes = $scope.query.notes;
              $scope.informationNeed = $scope.query.informationNeed;
            }
          );
        }
      });

      $scope.saveNotes = function() {
        $scope.query.saveNotes($scope.queryNotes, $scope.informationNeed)
          .then( function() {
            flash.success = 'Success! Your query details have been saved.';
            $scope.displayed.notes = false;
          }, function() {
            flash.error = 'Ooooops! Could not save your query details. Please try again.';
          });
      };
    }
  ]);
