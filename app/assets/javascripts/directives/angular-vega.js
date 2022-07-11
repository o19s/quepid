'use strict';

// hacked up from https://github.com/eptify/angular-vega/blob/master/src/angular-vega.js

/* jshint ignore:start */

var ngVega = angular.module('ngVega', []);

// Some Notes:
// Embedding links to other resources in your specs causes weird errors.
// What is here embeds a vega chart, but withoiut all the chrome around it.
// Had to comment out the scope.$watch cause we generate a ERROR TypeError: Promise.resolve is not a function error,
// and that made many of them show up!
// So yeah...

ngVega.directive('vega', function() {

    function link(scope, element, attrs) {
        //scope.$watch('spec', function () {
            //var r = vega.parse(scope.spec);
            vegaEmbed('#'+attrs.id, scope.spec).then(result => console.log(result)).catch(console.error);
            //vg.parse.spec(scope.spec, function(chart) {
            //    chart({el:"#"+attrs.id}).update();
            // })
        //}, true)
    }


    return {
        restrict: 'A',
        link: link,
        scope: {
            spec: '='
        }
    };
});
/* jshint ignore:end */
