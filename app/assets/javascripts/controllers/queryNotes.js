'use strict';

angular.module('QuepidApp')
  .controller('QueryNotesCtrl', [
    '$scope',
    function ($scope) {
      $scope.queryNotes = '';
      $scope.informationNeed = '';

      $scope.$watch('displayed.notes', function() {
        if($scope.displayed.notes) {
          /*
           * The panel renders editable immediately, so the user can start typing before this
           * fetch comes back. Assigning unconditionally meant a slow response wiped whatever
           * they had entered, so only take the fetched value if the field is untouched since
           * the request went out.
           */
          var pendingNotes = $scope.queryNotes;
          var pendingInformationNeed = $scope.informationNeed;

          $scope.query.fetchNotes()
            .then(function() {
              if($scope.queryNotes === pendingNotes) {
                $scope.queryNotes = $scope.query.notes;
              }
              if($scope.informationNeed === pendingInformationNeed) {
                $scope.informationNeed = $scope.query.informationNeed;
              }
            }
          );
        }
      });

      $scope.saveNotes = function() {
        $scope.query.saveNotes($scope.queryNotes, $scope.informationNeed)
          .then( function() {
            window.quepidDom.flash.show('success', 'Success! Your query details have been saved.');
            $scope.displayed.notes = false;
          }, function() {
            window.quepidDom.flash.show('error', 'Ooooops! Could not save your query details. Please try again.');
          });
      };
    }
  ]);
