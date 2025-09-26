'use strict';

/*
  component: qgraph

  displays a line graph of recent scores.

  ex. <qgraph max=5 scores="scoresVariable"></qgraph>

  arguments:
    max     (integer)               The maximum possible score for this item.
    scores  (angular variable name) The list of score to graph in this format:
                  [
                    { score: int, updated_at: date, note: string},
                    { score: int, updated_at: date, note: string}
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

      // Watches
      $scope.$watch('max', function() {
        ctrl.max = $scope.max;
        renderGraph();
      });

      $scope.$watchCollection('scores', function () {
        ctrl.scores = $scope.scores;
        renderGraph();
      });

      // Functions
      ctrl.render = renderGraph;

      function renderGraph() {
        // Ensure all required data is available
        if (!ctrl.scores || !ctrl.max || !$scope.graph || ctrl.width <= 0 || ctrl.height <= 0) {
          return;
        }

        // Remove existing elements
        $scope.graph.selectAll('path').remove();
        $scope.graph.selectAll('.marker').remove();

        // NOTE: slice is doing two jobs here:
        //     1. limit the number of points in the graph.
        //     2. create a shallow copy of the array.
        //     if you alter this, make sure 2 happens or there will be woe
        var data = ctrl.scores.slice(-10).sort(function (a, b) {
          return d3.ascending(a.updated_at, b.updated_at);
        });

        if (data.length === 0) {
          return;
        }

        var x = d3.scaleLinear().domain([0, (data.length - 1)]).range([0, ctrl.width]);
        var y = d3.scaleLinear().domain([0, ctrl.max]).range([ctrl.height, 0]);

        var line = d3.line()
          .x(function (d, i) {
            return x(i) + ctrl.margin.left;
          })
          .y(function (d) {
            return y(d.score);
          });

        // First, add the path
        $scope.graph.append('path').attr('d', line(data));

        // Then, add markers for annotations (on top of the path)
        data.forEach(function(d, i) {
          if (d.note) {
            var xpos = x(i) + ctrl.margin.left;
            $scope.graph.append('line')
              .attr('class', 'marker')
              .attr('x1', xpos)
              .attr('x2', xpos)
              .attr('y1', 0)
              .attr('y2', ctrl.height)
              .attr('class', 'marker')
              .style('pointer-events', 'all')
              .on('mouseover', function (event) { $scope.tip.show(d.note, this, event); })
              .on('mouseout', function () { $scope.tip.hide(); })
              .append('title')
              .text(d.note);
          }
        });
      }
    }
  ]);
