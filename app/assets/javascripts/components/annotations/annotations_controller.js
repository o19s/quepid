'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('AnnotationsCtrl', [
    '$scope',
    'flash',
    'caseSvc',
    'annotationsSvc',
    function(
      $scope,
      flash,
      caseSvc,
      annotationsSvc
    ) {
      var ctrl = this;

      ctrl.annotationsList  = [];
      ctrl.annotationModel  = {
        message: ''
      };

      ctrl.getSelectedCase  = caseSvc.getSelectedCase;
      ctrl.selectedCase     = caseSvc.getSelectedCase();

      // Functions
      ctrl.create   = create;
      ctrl.fetchAll = fetchAll;

      $scope.$watch('ctrl.getSelectedCase()', function() {
        if ( caseSvc.isCaseSelected() ) {
          ctrl.selectedCase = caseSvc.getSelectedCase();
          ctrl.fetchAll();
        }
      });

      $scope.$on('annotationDeleted', function(event, annotation) {
        ctrl.annotationsList.splice(ctrl.annotationsList.indexOf(annotation), 1);
      });

      $scope.$on('updatedCaseScore', function(event, theCase) {
        if (  angular.isDefined(ctrl.selectedCase) &&
              ctrl.selectedCase.caseNo === theCase.caseNo
        ) {
          ctrl.selectedCase.lastScore = theCase.lastScore;
        }
      });

      function create () {
        if (ctrl.selectedCase.lastScore === undefined){
          flash.error = 'Can\'t create a new annotation until searches have been run!  Please rerun your searches.';
          return;
        }

        var data = {
          annotation: ctrl.annotationModel,
          score: {
            all_rated:  ctrl.selectedCase.lastScore.all_rated,
            score:      ctrl.selectedCase.lastScore.score,
            try_id:     ctrl.selectedCase.lastScore.try_id,
            queries:    ctrl.selectedCase.lastScore.queries,
          }
        };

        annotationsSvc.create(ctrl.selectedCase.caseNo, data)
          .then(function(annotation) {
            ctrl.annotationsList.unshift(annotation);

            // Clear current message
            ctrl.annotationModel = { message: '' };

            flash.success = 'New Annotation created successfully!';
          }, function() {
            flash.error = 'Unable to create Annotation.';
          });
      }

      function fetchAll () {
        annotationsSvc.fetchAll(ctrl.selectedCase.caseNo)
          .then(function(list) {
            ctrl.annotationsList = list;
          });
      }
    }
  ]);
