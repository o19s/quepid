'use strict';

// Replacement for yaru22.angular-timeago (one use: annotation createdAt).
// Uses Intl.RelativeTimeFormat — no vendor module or $interval ticker needed for
// a static "posted X ago" label on annotations.

angular.module('QuepidApp')
  .filter('timeAgo', function () {
    var rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    var UNITS = [
      { unit: 'year',   seconds: 60 * 60 * 24 * 365 },
      { unit: 'month',  seconds: 60 * 60 * 24 * 30 },
      { unit: 'week',   seconds: 60 * 60 * 24 * 7 },
      { unit: 'day',    seconds: 60 * 60 * 24 },
      { unit: 'hour',   seconds: 60 * 60 },
      { unit: 'minute', seconds: 60 },
      { unit: 'second', seconds: 1 }
    ];

    return function (input) {
      if (!input) { return ''; }

      var date = new Date(input);
      if (isNaN(date.getTime())) { return ''; }

      var deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000);
      var abs = Math.abs(deltaSeconds);
      var i, slice;

      for (i = 0; i < UNITS.length; i++) {
        slice = UNITS[i];
        if (abs >= slice.seconds || slice.unit === 'second') {
          return rtf.format(Math.round(deltaSeconds / slice.seconds), slice.unit);
        }
      }

      return '';
    };
  });
