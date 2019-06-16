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

  NOTE: renaming 'max' to 'maxScore' breaks the graph!
*/

/* global d3 */

angular.module('QuepidApp')
  .directive('qgraph', [
    function () {
      return {
        restrict:     'E',
        controller:   'QgraphCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'qgraph/qgraph.html',
        scope:        {
          max:    '=',
          scores: '=',
        },
        link: function (scope, elem) {
          // Setup d3
          var margin  = { top: 2, right: 13, bottom: 6, left: 2 };
          var height  = elem.height() - margin.top - margin.bottom;
          var width   = elem.width() - margin.left - margin.right;

          scope.ctrl.height = height;
          scope.ctrl.margin = margin;
          scope.ctrl.width  = width;

          scope.tip = d3.tip().attr('class', 'd3-tip').html(function (d) {
            return '<div>' + d + '</div>';
          });

          scope.graph = d3.selectAll(elem.find('svg').toArray())
            .attr('width', width  + margin.left + margin.right)
            .attr('height', height + margin.top  + margin.bottom)
            .append('svg:g')
            .call(scope.tip)
            .attr(
              'transform',
              'translate(' + margin.left + ',' + margin.top + ')'
            );

          scope.ctrl.render();
        },
      };
    }
  ]);
