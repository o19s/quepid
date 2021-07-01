'use strict';
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
          case: '=',
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
            // Image Embed.  This is an alternative to the image: field spec.
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
