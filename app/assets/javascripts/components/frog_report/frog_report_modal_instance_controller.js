'use strict';

angular.module('QuepidApp')
  .controller('FrogReportModalInstanceCtrl', [
    '$uibModalInstance', '$scope',
    'theCase', 'queriesSvc',
    function ($uibModalInstance, $scope, theCase, queriesSvc) {
      var ctrl = this;

      ctrl.theCase = theCase;
      ctrl.queriesSvc = queriesSvc;

      // Functions
      ctrl.numberOfMissingRatings  = numberOfMissingRatings;
      ctrl.numberOfMissingRatingsByMissingCount = numberOfMissingRatingsByMissingCount;
      ctrl.totalNumberOfRatingsNeeded = totalNumberOfRatingsNeeded;
      ctrl.missingRatingsRate = missingRatingsRate;
      ctrl.totalNumberOfRatingsNeeded = totalNumberOfRatingsNeeded;
      ctrl.depthOfRating = depthOfRating;
      ctrl.numberOfRatings = numberOfRatings;

      /* jshint ignore:start */
      // We don't format the Vega spec as this is generated by Vega tooling.
      // We replace the data[0].values with our own data furthur down.
      $scope.spec = {
        "$schema": "https://vega.github.io/schema/vega/v5.json",
        "description": "A basic bar chart example, with value labels shown upon mouse hover.",
        "width": 800,
        "height": 150,
        "padding": 5,

        "data": [
          {
            "name": "table",
            "values": [
              {"category": "Fully Rated", "amount": 28},
              {"category": "Missing 1", "amount": 55},
              {"category": "Missing 2", "amount": 43},
              {"category": "Missing 3", "amount": 91},
              {"category": "Missing 4", "amount": 81},
              {"category": "Missing 5", "amount": 81},
              {"category": "Missing 6", "amount": 53},
              {"category": "Missing 7", "amount": 19},
              {"category": "Missing 8", "amount": 81},
              {"category": "Missing 9", "amount": 10},
              {"category": "No Ratings", "amount": 87}
            ]
          }
        ],

        "signals": [
          {
            "name": "tooltip",
            "value": {},
            "on": [
              {"events": "rect:mouseover", "update": "datum"},
              {"events": "rect:mouseout",  "update": "{}"}
            ]
          }
        ],

        "scales": [
          {
            "name": "xscale",
            "type": "band",
            "domain": {"data": "table", "field": "category"},
            "range": "width",
            "padding": 0.05,
            "round": true
          },
          {
            "name": "yscale",
            "domain": {"data": "table", "field": "amount"},
            "nice": true,
            "range": "height"
          }
        ],

        "axes": [
          { "orient": "bottom", "scale": "xscale" },
          { "orient": "left", "scale": "yscale" }
        ],

        "marks": [
          {
            "type": "rect",
            "from": {"data":"table"},
            "encode": {
              "enter": {
                "x": {"scale": "xscale", "field": "category"},
                "width": {"scale": "xscale", "band": 1},
                "y": {"scale": "yscale", "field": "amount"},
                "y2": {"scale": "yscale", "value": 0}
              },
              "update": {
                "fill": {"value": "steelblue"}
              },
              "hover": {
                "fill": {"value": "red"}
              }
            }
          },
          {
            "type": "text",
            "encode": {
              "enter": {
                "align": {"value": "center"},
                "baseline": {"value": "bottom"},
                "fill": {"value": "#333"}
              },
              "update": {
                "x": {"scale": "xscale", "signal": "tooltip.category", "band": 0.5},
                "y": {"scale": "yscale", "signal": "tooltip.amount", "offset": -2},
                "text": {"signal": "tooltip.amount"},
                "fillOpacity": [
                  {"test": "datum === tooltip", "value": 0},
                  {"value": 1}
                ]
              }
            }
          }
        ]
      };


      $scope.spec2 = {
        "$schema": "https://vega.github.io/schema/vega/v5.json",
        "description": "Visualize the evolution of your Tries",
        "width": 200,
        "height": 150,
        "padding": 5,

        "signals": [
          {
            "name": "labels", "value": true,
            "bind": {"input": "checkbox"}
          },
          {
            "name": "layout", "value": "tidy",
            "bind": {"input": "radio", "options": ["tidy", "cluster"]}
          },
          {
            "name": "links", "value": "diagonal",
            "bind": {
              "input": "select",
              "options": ["line", "curve", "diagonal", "orthogonal"]
            }
          },
          {
            "name": "separation", "value": false,
            "bind": {"input": "checkbox"}
          }
        ],

        "data": [
          {
            "name": "tree",
            "urloff": "http://localhost:3000/analytics/tries_visualization/4/vega_data.json",
            "values": [
              {
                "id": 36,
                "name": "Try 2",
                "parent": 4,
                "size": 10,
                "url": "http://localhost:3000/case/4/try/2",
                "query_params": "{\n  \"query\": {\n    \"match_all\": {}\n  }\n}"
              },
              {
                "id": 4,
                "name": "Try 1",
                "size": 10,
                "url": "http://localhost:3000/case/4/try/1",
                "query_params": "{\"query\": {\"match_all\": {}}}"
              }
            ],
            "transform": [
              {
                "type": "stratify",
                "key": "id",
                "parentKey": "parent"
              },
              {
                "type": "tree",
                "method": {"signal": "layout"},
                "size": [{"signal": "height"}, {"signal": "width - 100"}],
                "separation": {"signal": "separation"},
                "as": ["y", "x", "depth", "children"]
              }
            ]
          },
          {
            "name": "links",
            "source": "tree",
            "transform": [
              { "type": "treelinks" },
              {
                "type": "linkpath",
                "orient": "horizontal",
                "shape": {"signal": "links"}
              }
            ]
          }
        ],

        "scales": [
          {
            "name": "color",
            "type": "linear",
            "range": {"scheme": "magma"},
            "domain": {"data": "tree", "field": "depth"},
            "zero": true
          }
        ],

        "marks": [
          {
            "type": "path",
            "from": {"data": "links"},
            "encode": {
              "update": {
                "path": {"field": "path"},
                "stroke": {"value": "#ccc"}
              }
            }
          },
          {
            "type": "symbol",
            "from": {"data": "tree"},
            "encode": {
              "enter": {
                "size": {"value": 100},
                "stroke": {"value": "#fff"},
                "href": {"field": "url", "type": "nominal"},
                "tooltip": {"field": "query_params", "type": "nominal"}
              },
              "update": {
                "x": {"field": "x"},
                "y": {"field": "y"},
                "fill": {"scale": "color", "field": "depth"}
              }
            }
          },
          {
            "type": "text",
            "from": {"data": "tree"},
            "encode": {
              "enter": {
                "text": {"field": "name"},
                "fontSize": {"value": 9},
                "baseline": {"value": "middle"},
                "href": {"field": "url", "type": "nominal"},
                "tooltip": {"field": "query_params", "type": "nominal"}
              },
              "update": {
                "x": {"field": "x"},
                "y": {"field": "y"},
                "dx": {"signal": "datum.children ? -7 : 7"},
                "align": {"signal": "datum.children ? 'right' : 'left'"},
                "opacity": {"signal": "labels ? 1 : 0"}
              }
            }
          }
        ]
      };

      // populate specific data in the specification for the chart.
      $scope.spec.data = tableOfRatings();

      /* jshint ignore:end */

      function tableOfRatings() {
        var numberOfMissingRatingsByMissingCount = ctrl.numberOfMissingRatingsByMissingCount();
        var rows = [];

        angular.forEach(Object.keys(numberOfMissingRatingsByMissingCount).sort(function(a, b){return parseInt(a)-parseInt(b)}), function(key) {
          rows.push({'category': numberOfMissingRatingsByMissingCount[key].label, 'amount': numberOfMissingRatingsByMissingCount[key].count});
        });
        return [
          {
            "name": "table",
            "values": rows
          }
        ];
      }

      function numberOfMissingRatings() {
        var countMissingRatings = 0;
        angular.forEach(queriesSvc.queries, function(q) {
          countMissingRatings = countMissingRatings + q.currentScore.countMissingRatings;
        });

        return countMissingRatings;
      };

      function numberOfMissingRatingsByMissingCount() {
        var depthOfRating = ctrl.depthOfRating();
        var missingRatingsTable = {};
        angular.forEach(queriesSvc.queries, function(q) {
          var missingCount = parseInt(q.currentScore.countMissingRatings);
          if (!missingRatingsTable.hasOwnProperty(missingCount)){
            missingRatingsTable[missingCount] = {
              count: 0
            }
            if (missingCount == 0){
              missingRatingsTable[missingCount].label = "Fully Rated";
            }
            else if (missingCount == depthOfRating){
              missingRatingsTable[missingCount].label = "No Ratings";
            }
            else {
              missingRatingsTable[missingCount].label = "Missing " + missingCount;
            }
          }
          missingRatingsTable[missingCount].count = missingRatingsTable[missingCount].count + 1;
        });

        return missingRatingsTable;

      }

      // What percentage of our total query/doc pairs are missing ratings?
      function missingRatingsRate() {
        var numberOfMissingRatings = ctrl.numberOfMissingRatings();
        var totalNumberOfRatings = ctrl.totalNumberOfRatingsNeeded();

        return Math.trunc((numberOfMissingRatings / totalNumberOfRatings) * 100);
      };

      function totalNumberOfRatingsNeeded() {
        var totalNumberOfRatings = 0;
        angular.forEach(queriesSvc.queries, function(q) {
          totalNumberOfRatings = totalNumberOfRatings + q.depthOfRating;
        });
        return totalNumberOfRatings;
      };

      function depthOfRating() {
        var depthOfRating = 0;
        angular.forEach(queriesSvc.queries, function(q) {
          if (q.depthOfRating > depthOfRating){
            depthOfRating = q.depthOfRating;
          }
        });
        return depthOfRating;
      };

      function numberOfRatings() {
        var countRatings = 0;
        angular.forEach(queriesSvc.queries, function(q) {
          countRatings = countRatings + Object.keys(q.ratings).length;
        });

        return countRatings;
      };

      ctrl.ok = function () {
        $uibModalInstance.close(ctrl.options);
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
