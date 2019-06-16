'use strict';

/*global ace */
ace.config.set('workerPath', '/javascripts/ace');
ace.config.set('themePath',  '/javascripts/ace');

$(function() {

  // For some reason when angular is in charge of refreshing the DOM,
  // the old height of the element is the one that's being returned.
  // So we need to tell it to "refetch" the element from the DOM to refresh
  // and get the new height.
  // WEIRD....
  var $element    = $('#query-params-editor');
  var lastHeight  = $element.height();
  var margin      = 50;
  function checkForChanges()
  {
    $element = $('#query-params-editor');
    if ($element.height() !== lastHeight)
    {
      $(document).trigger('devSettingsHeightChange');
      lastHeight = $element.height();
    }

    setTimeout(checkForChanges, 500);
  }
  checkForChanges();

  function resizeAce() {
    var height = $('#query-params-editor').height();
    if ( height === null ) {
      setTimeout(function () {
        resizeAce();
      }, 200);
      return;
    }

    $('.es-query-params').height(height - margin);

    // delay, because... computers!
    // if on another page (/cases, or /teams) and switch to case page,
    // then for some reason `$('#query-params-editor').height()` returns 100
    // when toggling the pane ON, and the right size when OFF!!!
    // a 100ms delay creates some weird behavior in the ace editor.
    // 200ms works just fine. GO FIGURE!
    setTimeout(function () {
      $('.es-query-params').height(height - margin);

      // must repaint the editor, or else.... BOOM!
      if ( $('#es-query-params-editor').length > 0 ) {
        var editor = ace.edit('es-query-params-editor');
        editor.resize();
      }
    }, 200);
  }

  //set initially
  resizeAce();

  //listen for changes
  $(window).resize(resizeAce);
  $(document).on('toggleEast', resizeAce);
  $(document).on('devSettingsHeightChange', resizeAce);

  $('[name="queryParams"]').keyup(function() {
    var input = $(this);
    var value = input.val();

    var options = {
      container: '.pane_container',
      html:      true,
      placement: 'auto left',
      template:  '<div class="popover syntax-popover" role="tooltip"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>',
      title:     'You may have a syntax error <button type="button" id="close" class="close" onclick="$(&quot;.syntax-popover&quot;).popover(&quot;hide&quot;);">&times;</button>',
      trigger:   'manual',
    };

    var params = {
      deftype:               'defType',
      echoparams:            'echoParams',
      explainother:          'explainOther',
      logparamslist:         'logParamsList',
      omitheader:            'omitHeader',
      segmentterminateearly: 'segmentTerminateEarly',
      timeallowed:           'timeAllowed',
    };

    var warn = false;

    for (var key in params) {
      var correct = params[key];
      var re      = new RegExp(key);

      if ( value.match(re) ) {
        options.content = 'You query params contain <code>' + key + '</code>, you probably meant <code>' + correct + '</code>';
        warn = true;
        break;
      }
    }

    if ( warn ) {
      input.popover(options);
      input.popover('show');
    } else {
      input.popover('destroy');
    }
  });
});
