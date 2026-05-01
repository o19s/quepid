/**
 * AngularJS CountUp directive
 * @version v0.0.1
 * @link https://github.com/dmitriy-borisov/angular-countup
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
(function(a) {
	'use strict';
	
	a.module('countUp', []).directive('countUp', ['$interval', function($interval) {
		return {
			restrict: 'AE',
			scope: {
				value: '=ngModel',
			},
			controller: [ '$scope', '$element', '$attrs', function($scope, $element, $attrs) {
				var count,
					steps = parseInt($attrs.steps, 10) || 10,
					time = parseInt($attrs.time, 10) || 1000,
					after = $attrs.after || "",
					before = $attrs.before || "",
					decimals = parseInt($attrs.decimals, 10) || 0;

				var changing = function(newVal, oldVal) {
					$interval.cancel(count);

					newVal = (newVal) ? parseFloat(newVal.toFixed(decimals)) : 0;
					oldVal = (typeof oldVal !== 'undefined') ? oldVal : newVal;

					var step = 0;
					count = $interval(function() {
						step++;
						
						var result = oldVal + ((newVal - oldVal) / steps * step);
						result = result.toFixed(decimals);
						
						$element.html(before + result + after);
					}, time / steps, steps);
				}

				$scope.$watch('value', changing);
			}]
		};
	}]);
})(angular);