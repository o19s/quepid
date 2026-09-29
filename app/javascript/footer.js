'use strict';

document.addEventListener('DOMContentLoaded', function() {
  var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

  var observer = new MutationObserver(function() {
    var footer = document.querySelector('body > footer');
    var footerCopy = document.getElementById('footer-copy');
    var paneMain = document.querySelector('.pane_main');

    if ( paneMain ) {
      if ( footer ) {
        footer.style.display = 'none';
      }

      if ( !footerCopy && footer ) {
        footerCopy = footer.cloneNode(true);
        footerCopy.id = 'footer-copy';
        paneMain.appendChild(footerCopy);
      }

      if ( footerCopy ) {
        footerCopy.style.display = '';
      }
    } else {
      if ( footer ) {
        footer.style.display = '';
      }
      if ( footerCopy ) {
        footerCopy.style.display = 'none';
      }
    }
  });

  observer.observe(document, {
    childList: true,
    subtree:   true,
  });
});
