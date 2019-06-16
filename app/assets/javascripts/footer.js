'use strict';

$(function() {
  var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

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
    } else {
      $('body > footer').show();
      $('#footer-copy').hide();
    }
  });

  observer.observe(document, {
    childList: true,
    subtree:   true,
  });
});
