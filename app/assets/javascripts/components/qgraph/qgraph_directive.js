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
                    { note: string, updated_at: date },
                    { note: string, updated_at: date }
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
          max:         '=',
          scores:      '=',
          annotations: '=',
        },
        link: function (scope, elem) {
          // Setup d3
          var margin  = { top: 2, right: 13, bottom: 6, left: 2 };
          var height  = elem.height() - margin.top - margin.bottom;
          var width   = elem.width() - margin.left - margin.right;

          scope.ctrl.height = height;
          scope.ctrl.margin = margin;
          scope.ctrl.width  = width;

          // Create a tooltip div instead of using d3-tip
          var tooltip = d3.select('body').append('div')
            .attr('class', 'd3-tip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('pointer-events', 'none');

          scope.tip = {
            show: function(content, element, event) {
              var coords = d3.pointer(event || d3.event, document.body);
              tooltip.transition()
                .duration(200)
                .style('opacity', .9);
              tooltip.html('<div>' + content + '</div>')
                .style('left', (coords[0] + 10) + 'px')
                .style('top', (coords[1] - 28) + 'px');
            },
            hide: function() {
              tooltip.transition()
                .duration(500)
                .style('opacity', 0);
            }
          };

          scope.graph = d3.select(elem.find('svg')[0])
            .attr('width', width  + margin.left + margin.right)
            .attr('height', height + margin.top  + margin.bottom)
            .append('g')
            .attr(
              'transform',
              'translate(' + margin.left + ',' + margin.top + ')'
            );

          scope.ctrl.render();

          // Cleanup tooltip on directive destroy
          scope.$on('$destroy', function() {
            tooltip.remove();
          });
        },
      };
    }
  ]);
