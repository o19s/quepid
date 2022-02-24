'use strict';

$(function() {
  // Used by the scale labels in the communal_scorers admin page.
  var scaleElement = $('input[data-live-update]');
  if ( scaleElement.length ) {
    scaleElement.on('change', function() {
      var labelsId = scaleElement.data('live-update');
      var values   = scaleElement.val().replace(/,\s*$/, '').split(',');
      var labels   = $('#' + labelsId);

      labels.empty();
      $.each(values, function(key, value) {
        var input = $('<label>' + value + '</label>')
          .addClass('scale-with-label-element clearfix')
          .append($('<input>')
            .attr({
              type: 'text',
              name: 'scorer[scale_with_labels][' + value + ']'
            })
            .addClass('form-control scale-label clearfix')
          );

          labels.append(input);
      });
    });
  }
});
