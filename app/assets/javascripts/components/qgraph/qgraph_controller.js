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
                    { message: string, updatedAt: date },
                    { message: string, updatedAt: date }
                  ]
*/

/* global vegaEmbed */
/* jshint latedef: false */

angular.module('QuepidApp')
  .controller('QgraphCtrl', [
    '$scope',
    function ($scope) {
      var ctrl = this;

      // Attributes
      ctrl.height     = 0;
      ctrl.margin     = 0;
      ctrl.width      = 0;
      ctrl.container  = null;
      ctrl.vegaResult = null;
      ctrl.max        = $scope.max;
      ctrl.scores     = $scope.scores;
      ctrl.annotations = $scope.annotations;

      // Watches
      $scope.$watch('max', function() {
        ctrl.max = $scope.max;
        renderGraph();
      });

      $scope.$watchCollection('scores', function () {
        ctrl.scores = $scope.scores;
        if (ctrl.max && ctrl.scores.length > 0) {
          renderGraph();
        }
      });

      $scope.$watchCollection('annotations', function () {
        ctrl.annotations = $scope.annotations;
        // Only re-render if we have scores
        if (ctrl.scores && ctrl.scores.length > 0 && ctrl.max) {
          renderGraph();
        }
      });

      // Functions
      ctrl.render = renderGraph;

      function byUpdatedAtAscending(a, b) {
        return new Date(a.updated_at) - new Date(b.updated_at);
      }

      function renderGraph() {
        // Ensure all required data is available
        if (!ctrl.container || ctrl.width <= 0 || ctrl.height <= 0 || !ctrl.max) {
          return;
        }

        // Ensure we have scores to render
        if (!ctrl.scores || ctrl.scores.length === 0) {
          return;
        }

        // We want to have the last ten scores, and ANY annotations that happened
        // during that time range.
        var sortedScores  = ctrl.scores.slice().sort(byUpdatedAtAscending);
        var lastTenScores = sortedScores.slice(-10);

        if (lastTenScores.length === 0) {
          return;
        }

        // Each score gets an evenly-spaced x slot (its rank, 0..n-1) rather
        // than one proportional to actual elapsed time, so the sparkline
        // keeps showing "last 10 results" evenly rather than bunching up
        // when scores happen close together.
        var scoreData = lastTenScores.map(function (score, index) {
          return { index: index, score: score.score };
        });

        var minDate = new Date(lastTenScores[0].updated_at);

        // Annotations newer than the oldest displayed score are snapped to
        // the x slot of whichever displayed score is nearest to them in
        // time, so they always land on the same ordinal scale the score
        // line uses.
        var annotationData = ctrl.annotations
          .filter(function (annotation) {
            return annotation.updatedAt && new Date(annotation.updatedAt) >= minDate;
          })
          .map(function (annotation) {
            var annotationTime = new Date(annotation.updatedAt).getTime();

            var nearestIndex = lastTenScores.reduce(function (nearest, score, index) {
              var distance = Math.abs(new Date(score.updated_at).getTime() - annotationTime);
              return distance < nearest.distance ? { index: index, distance: distance } : nearest;
            }, { index: 0, distance: Infinity }).index;

            return { index: nearestIndex, message: annotation.message };
          });

        if (ctrl.vegaResult) {
          ctrl.vegaResult.finalize();
          ctrl.vegaResult = null;
        }
        ctrl.container.innerHTML = '';

        vegaEmbed(ctrl.container, buildSpec(scoreData, annotationData), {
          actions:  false,
          renderer: 'svg',
          tooltip:  { theme: 'dark' },
        })
          .then(function (result) {
            ctrl.vegaResult = result;
          })
          .catch(function (error) {
            console.error('Error rendering qgraph:', error);
          });
      }

      function buildSpec(scoreData, annotationData) {
        return {
          $schema:    'https://vega.github.io/schema/vega-lite/v6.json',
          width:      ctrl.width,
          height:     ctrl.height,
          autosize:   { type: 'none' },
          padding:    ctrl.margin,
          background: null,
          layer: [
            {
              // The score line. Styled via the `qgraph path` CSS rule
              // rather than here, so the color stays in one place.
              data: { values: scoreData },
              mark: { type: 'line', interpolate: 'linear' },
              encoding: {
                x: { field: 'index', type: 'ordinal', axis: null },
                y: {
                  field: 'score',
                  type:  'quantitative',
                  scale: { domain: [ 0, ctrl.max ] },
                  axis:  null,
                },
              },
            },
            {
              // Annotation markers. A rule mark with no y/y2 encoding spans
              // the full height of the plot, same as the old x1/x2 lines.
              // Styled via the `qgraph line` CSS rule.
              data: { values: annotationData },
              mark: { type: 'rule' },
              encoding: {
                x: { field: 'index', type: 'ordinal', axis: null },
                // A plain signal (rather than a field encoding) keeps the
                // tooltip to just the message text, matching the old
                // hand-rolled tooltip instead of vega-tooltip's default
                // "field: value" table row.
                tooltip: { value: { signal: 'datum.message' } },
              },
            },
          ],
          config: { view: { stroke: 'transparent' } },
        };
      }
    }
  ]);
