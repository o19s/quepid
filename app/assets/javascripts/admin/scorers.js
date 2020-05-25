'use strict';

/*global ace */

$(function() {
  $.each($('.scorer .code > div'), function(index, element) {
    var id        = $(element).attr('id');
    var readonly  = $(element).data('readonly');

    var code        = $(element).data('code').replace(/\n/g, '\n');
    var codeArray   = code.split('\\n');
    code            = codeArray.join('\n');

    var editor = ace.edit(id);
    editor.setTheme('ace/theme/chrome');
    editor.getSession().setMode('ace/mode/javascript');
    editor.setValue(code);

    if ( readonly !== undefined && readonly ) {
      editor.setReadOnly(true);
    }
  });

  var codeElement = $('#scorer-code-editor');
  if ( codeElement.length ) {
    var code        = codeElement.data('code').replace(/\n/g, '\n');
    var codeArray   = code.split('\\n');
    code            = codeArray.join('\n');
    var editor      = ace.edit('scorer-code-editor');
    editor.setTheme('ace/theme/chrome');
    editor.getSession().setMode('ace/mode/javascript');
    editor.setValue(code);

    codeElement.closest('form').submit(function () {
      var value       = editor.getSession().getValue();
      var valueField  = $('#scorer_code');
      valueField.val(value);
    });
  }

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
