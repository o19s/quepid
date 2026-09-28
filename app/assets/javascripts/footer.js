'use strict';

$(function() {
  var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

  var lastFooterHeight = null;

  function pinFooterCopy() {
    var footerCopy = $('#footer-copy');
    if ( footerCopy.length && footerCopy.is(':visible') ) {
      var height = footerCopy.outerHeight();
      if ( height !== lastFooterHeight ) {
        lastFooterHeight = height;
        $('.pane_main').css('padding-bottom', height);
      }
    }
  }

  var observer = new MutationObserver(function() {
    if ( $('.pane_main').length ) {
      $('body > footer').hide();

      var footerCopy;
      if ( $('#footer-copy').length === 0 ) {
        footerCopy = $('body > footer').clone();
        footerCopy.attr('id', 'footer-copy');
        footerCopy.appendTo('.pane_main');
      } else {
        footerCopy = $('#footer-copy');
      }

      footerCopy.show();
      pinFooterCopy();
    } else {
      $('body > footer').show();
      $('#footer-copy').hide();
    }
  });

  observer.observe(document, {
    childList: true,
    subtree:   true,
  });

  var resizeTimeout;
  $(window).on('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(pinFooterCopy, 100); // 100ms debounce
  });
});
