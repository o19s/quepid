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

    function embed(scope, element, attrs) {
        // Specs written with a fixed pixel width (e.g. the frog report's
        // 800) leave a gap when the container is wider, or overflow it when
        // narrower. Stretch to whatever width the container actually has.
        if (scope.spec && typeof scope.spec.width === 'number' && element.width() > 0) {
            scope.spec.width = element.width();
        }

        vegaEmbed('#'+attrs.id, scope.spec).catch(console.error);
    }

    function link(scope, element, attrs) {
        var modalEl = element.closest('.modal');

        if (modalEl.length) {
            // This directive is only ever used inside a modal, and Angular
            // compiles (and links) the modal's content while it's still
            // `display: none` — the container has no measurable width yet.
            // Wait until Bootstrap has actually shown it.
            modalEl.one('shown.bs.modal', function () {
                embed(scope, element, attrs);
            });
        } else {
            embed(scope, element, attrs);
        }
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
