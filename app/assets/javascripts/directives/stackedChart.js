'use strict';
angular.module('QuepidApp')
  .filter('stackChartColor', [
    function() {
      var colorClasses = ['red', 'orange', 'green', 'blue'];
      return function(input) {
        var idx = (input % colorClasses.length);
        return 'chart-area ' + colorClasses[idx];
      };
    }
  ]);

angular.module('QuepidApp')
  .filter('stackChartHeight', [
    function() {
      return function(input) {
        return {'height': input + '%'};
      };
    }
  ]);

angular.module('QuepidApp')
  .filter('stackChartLeftover', [
    function() {
      return function(allMatches) {
        var leftover = 100.0;
        angular.forEach(allMatches, function(match) {
          leftover -= match.percentage;
        });
        if (leftover < 0) {
          leftover = 0;
        }
        return {'height': leftover + '%'};
      };
    }
  ]);

angular.module('QuepidApp')
  .directive('stackedChart', [
    '$uibModal',
    function ($uibModal) {
      return {
        restrict: 'E',
        priority: 1000,
        scope: {
            doc: '=',
            maxDocScore: '=',
            viewport: '='
          },
        templateUrl: 'views/stackedChart.html',
        link: function(scope, element) {

          var openModal = function() {
            $uibModal.open({
              templateUrl: 'views/detailedExplain.html',
              controller: 'DocExplainCtrl',
              //windowClass: 'detailed-explain-modal',
              resolve: {
                doc: function() {
                  return scope.doc;
                },
                maxScore: function() {
                  return scope.maxDocScore;
                }
              }
            });
          };

          var myPop = element.find('.popper');

          myPop.popover({
            html:     true,
            trigger:  'manual',
            viewport: scope.viewport, //'#query-container'
            title:    function() {
              return element.find('.explain_pop_title').html();
            },
            content:  function() {
              return element.find('.explain_pop').html();
            },
          })
          .click(function() {
            var content = $('.popover-content');
            myPop.popover('show');

            // Link btn to modal
            setTimeout(function() {
              content.find('.btn').click(openModal);
            }, 0);

            var hidePopup = function(e) {
              // if the target of the click isn't the container
              // nor a descendant of the container
              var isOriginalLink      = element.is(e.target);
              var isLinkDescendant    = element.has(e.target).length > 0;
              var isPopover           = content.is(e.target);
              var isPopoverDescendant = content.has(e.target).length > 0;

              if ( !( isOriginalLink || isLinkDescendant ||
                      isPopover || isPopoverDescendant )
              ) {
                myPop.popover('hide');
                $(document).unbind('mouseup', hidePopup);
              }
            };

            $(document).bind('mouseup', hidePopup);
          });
        }
      };
    }
  ]);
