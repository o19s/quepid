'use strict';

/*
  component: qgraph

  displays a line graph of recent scores with annotations.

  ex. <qgraph max=5 scores="scoresVariable" annotations="annotationsVariable"></qgraph>

  arguments:
    max         (integer)               The maximum possible score for this item.
    scores      (angular variable name) The list of scores to graph in this format:
                  [
                    { score: int, updated_at: date },
                    { score: int, updated_at: date }
                  ]
    annotations (angular variable name) The list of annotations to display as markers:
                  [
                    { message: string, updated_at: date },
                    { message: string, updated_at: date }
                  ]
*/

/* global d3 */
/* jshint latedef: false */

angular.module('QuepidApp')
  .controller('QgraphCtrl', [
    '$scope',
    function ($scope) {
      var ctrl = this;

      // Attributes
      ctrl.height = 0;
      ctrl.margin = 0;
      ctrl.width  = 0;
      ctrl.max    = $scope.max;
      ctrl.scores = $scope.scores;
      ctrl.annotations = $scope.annotations;

      // Watches
      //$scope.$watch('max', function(newVal, oldVal) {
      //  if (newVal !== undefined) {
      $scope.$watch('max', function() {
        ctrl.max = $scope.max;
        renderGraph();
      });

      //$scope.$watchCollection('scores', function (newVal, oldVal) {
      $scope.$watchCollection('scores', function () {
        ctrl.scores = $scope.scores;
        if (ctrl.max && ctrl.scores.length > 0) {
          renderGraph();
        }
      });

      $scope.$watchCollection('annotations', function (newVal, oldVal) {
        if (newVal !== undefined) {
          ctrl.annotations = newVal;
          // Only re-render if we have scores
          if (ctrl.scores && ctrl.scores.length > 0 && ctrl.max) {
            renderGraph();
          }
        }
      });

      // Functions
      ctrl.render = renderGraph;

      function renderGraph() {
        // Ensure all required data is available
        if (!$scope.graph || ctrl.width <= 0 || ctrl.height <= 0 || !ctrl.max) {
          return;
        }

        // Ensure we have scores to render
        if (!ctrl.scores || ctrl.scores.length === 0) {
          return;
        }

        // We want to have the last ten scores, and ANY annotations that happened
        // during that time range.  So some complex logic to figure that out.
        // Create a copy of scores and sort by date
        var sortedScores = ctrl.scores.slice().sort(function (a, b) {
          return d3.ascending(a.updated_at, b.updated_at);
        });

        // Take the last 10 scores
        var lastTenScores = sortedScores.slice(-10);
        
        var data = [];
        
        if (lastTenScores.length === 0) {
          // No scores to display
          return;
        } else {
          // Get the time range of these last 10 scores
          var minDate = new Date(lastTenScores[0].updated_at);
          
          // Add the last 10 scores to data with type 'score'
          lastTenScores.forEach(function(score) {
            data.push({
              type: 'score',
              score: score.score,
              updated_at: score.updated_at,
              message: null
            });
          });
          
          // Add annotations that are newer then the oldest score that we displaying.          
          ctrl.annotations.forEach(function(annotation) {
            var annotationDateStr = annotation.updatedAt;
            if (annotationDateStr) {
              var annotationDate = new Date(annotationDateStr);            
              if (annotationDate >= minDate) {
                data.push({
                  type: 'annotation',
                  score: null,
                  updated_at: annotationDateStr, // Keep as string for consistency with scores
                  message: annotation.message
                });
              }
            }
          });
        
          // Sort the combined data by date
          data.sort(function (a, b) {
            return d3.ascending(a.updated_at, b.updated_at);
          });
        }
        // Data is now prepared with the last 10 scores and relevant annotations

        // Filter out just the scores for the line graph
        var scoreData = data.filter(function(d) {
          return d.type === 'score' && d.score !== null;
        });

        if (scoreData.length === 0) {
          return;
        }

        // Only remove existing elements after we've validated we have data to render
        $scope.graph.selectAll('path').remove();
        $scope.graph.selectAll('.marker').remove();

        var x = d3.scaleLinear().domain([0, (scoreData.length - 1)]).range([0, ctrl.width]);
        var y = d3.scaleLinear().domain([0, ctrl.max]).range([ctrl.height, 0]);

        var line = d3.line()
          .x(function (d, i) {
            return x(i) + ctrl.margin.left;
          })
          .y(function (d) {
            return y(d.score);
          });

        // First, add the path for scores only
        $scope.graph.append('path').attr('d', line(scoreData));

        // Then, add markers for annotations (on top of the path)
        // We need to position annotations based on their timestamp relative to scores
        data.forEach(function(d, i) {
          if (d.type === 'annotation' && d.message) {
            // Find the position of this annotation in the timeline
            // Map it to the x-axis based on its position in the full data array
            var xpos = (i / (data.length - 1)) * ctrl.width + ctrl.margin.left;

            $scope.graph.append('line')
              .attr('class', 'marker')
              .attr('x1', xpos)
              .attr('x2', xpos)
              .attr('y1', 0)
              .attr('y2', ctrl.height)
              .attr('class', 'marker')        
              .style('pointer-events', 'all')
              .on('mouseover', function (event) { $scope.tip.show(d.message, this, event); })
              .on('mouseout', function () { $scope.tip.hide(); })
              .append('title')
              .text(d.message);
          }
        });
      }
    }
  ]);
