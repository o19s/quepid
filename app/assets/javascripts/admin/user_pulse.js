/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

/*
This code was converted over from coffee script, and then triggered a bunch of jshint
errors that we then ignored.
*/


(function() {

  'use strict';



  $('[data-pulse]').each(function() {
    const div         = $(this);
    const selector    = div.data('item-selector');
    const url         = div.data('url');
    const date        = div.data('signup-date');
    const signup_date = new Date(date);

    const now        = new Date();
    const start_date = new Date(1900+now.getYear(), now.getMonth() - 11, 1);

    const cal = new CalHeatMap();
    return cal.init({
      cellSize:     20,
      data:         `${url}&start={{d:start}}&end={{d:end}}`,
      dataType:     'json',
      domain:       'month',
      highlight:    [ 'now', signup_date],
      itemSelector: selector,
      start:        start_date,
      subDomain:    'day',
    });});

})();
