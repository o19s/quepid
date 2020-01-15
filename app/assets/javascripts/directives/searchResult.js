'use strict';
/*Style we used when we deceted a doc had a rating*/
angular.module('QuepidApp')
  .filter('thumbStyle', [
    function() {
      return function(doc) {
        if (doc.hasOwnProperty('thumb')) {
          return {'width': '300px',
                  'height': '200px',
                  'display': 'inline-block',
                  'overflow-y': 'auto',
                  'border-width': '1px',
                  'border-style': 'solid'};
        }
        else {
          return {};
        }
      };
    }
  ]);

angular.module('QuepidApp')
  .directive('searchResult', [
    function () {
      return {
        restrict: 'E',
        scope: {
          doc: '=', /*document being displayed*/
          fieldSpec: '=',
          maxDocScore: '=',
          explainView: '=',
          explainViewport: '=',
          query: '=',
          docId: '=',
          rank: '@'
        },
        controller: 'SearchResultCtrl',
        templateUrl: 'views/searchResult.html'
      };
    }
  ]);

angular.module('QuepidApp')
  .directive('quepidEmbed', [
    function() {
      function isAudio(val) {
        var audioExtensions = [
            '.mp3',
            '.wav',
            '.ogg'
        ];

        return (new RegExp(audioExtensions.join('|')).test(val));
      }

      function isImage(val) {
        var imageExtensions = [
            '.jpg',
            '.jpeg',
            '.gif',
            '.png'
        ];

        return (new RegExp(imageExtensions.join('|')).test(val));
      }

      function isVideo(val) {
        var videoExtensions = [
            '.mp4',
            '.webm'
        ];

        return (new RegExp(videoExtensions.join('|')).test(val));
      }

      return {
        restrict: 'A',
        scope: {
          src: '='
        },
        templateUrl: 'views/embed.html',
        link: function(scope) {
            // Init vars
            scope.audioSrc = scope.imageSrc = scope.videoSrc = null;

            // Audio Embed
            if (isAudio(scope.src)) {
                scope.audioSrc = scope.src;
            // Image Embed
            } else if (isImage(scope.src)) {
                scope.imageSrc = scope.src;
            // Video Embed
            } else if(isVideo(scope.src)) {
                scope.videoSrc = scope.src;
            }
        }
      };
    }
  ]);
