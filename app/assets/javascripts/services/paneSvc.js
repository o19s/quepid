'use strict';

angular.module('QuepidApp')
  .service('paneSvc', [
    '$timeout',
    'eastPaneWidth',
    function paneSvc($timeout, eastPaneWidth) {
      var container;
      var east;
      var main;
      var slider;

      /* Move the left edge of east to x
       * */
      var moveEastTo = function(x) {
        slider.style.left = x + 'px';
        east.style.left = (6 + x) + 'px';
        main.style.width = (x) + 'px';
        east.style.width = (container.offsetWidth - x) + 'px';
      };

      var dragElement = function(evt) {
        moveEastTo(evt.clientX);
        eastPaneWidth = $(east).width();
      };

      var grabSlider = function() {
        document.onmousemove = dragElement;
        east.style.display = 'block';
        return false;
      };

      var releaseSlider = function() {
        document.onmousemove = null;
      };


      var toggled = false;


      /* If toggled, unhide the
      * east slider east pane, then
      * bind to the slider's events for dragging
      * otherwise do the opposite
      * */
      var setupPane = function() {
        if (toggled) {
          slider.onmousedown = grabSlider;
          document.onmouseup = releaseSlider;
          moveEastTo(container.offsetWidth - eastPaneWidth);
          $(slider).show();
          $(east).show();
        }
        else {
          slider.onmousedown = null;
          document.onmouseup = null;
          $(slider).hide();
          $(east).hide();
          moveEastTo(container.offsetWidth);
        }
      };

      var refreshElements = function() {
        slider  = document.getElementsByClassName('east-slider')[0];
        container = document.getElementsByClassName('pane_container')[0];
        east = document.getElementsByClassName('pane_east')[0];
        main = document.getElementsByClassName('pane_main')[0];
        east.style.left = slider.style.left = (container.offsetWidth - 20) + 'px';

        slider.onmousedown = grabSlider;
        document.onmouseup = releaseSlider;

        if (container.offsetWidth === 0) {
          $timeout(function() {
            refreshElements();
          }, 200);
        } else {
          setupPane();
        }
      };

      var toggleEast = function() {
        toggled = !toggled;
        setupPane();
      };

      $(window).on('resize', function() {
        if (toggled) {
          moveEastTo(container.offsetWidth - eastPaneWidth);
        }
        else {
          moveEastTo(container.offsetWidth);
        }
      });

      $(document).on('toggleEast', toggleEast);

      this.refreshElements = refreshElements;
    }
  ]);
