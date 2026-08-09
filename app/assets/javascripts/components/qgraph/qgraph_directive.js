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
          // Leaves room so the line's stroke width and the rule marks don't
          // get clipped at the edges of the container.
          var margin = { top: 4, right: 6, bottom: 4, left: 4 };

          scope.ctrl.margin    = margin;
          scope.ctrl.height    = elem.height() - margin.top  - margin.bottom;
          scope.ctrl.width     = elem.width()  - margin.left - margin.right;
          scope.ctrl.container = elem.find('div')[0];

          scope.ctrl.render();

          // vegaEmbed attaches its own tooltip handler and event listeners
          // to the container, so they need to be torn down along with it.
          scope.$on('$destroy', function() {
            if (scope.ctrl.vegaResult) {
              scope.ctrl.vegaResult.finalize();
            }
          });
        },
      };
    }
  ]);
