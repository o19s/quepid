'use strict';

angular.module('ng-rails-csrf', [] )
  .config([
    '$httpProvider',
    function($httpProvider) {
      var getToken = function() {
        var el = document.querySelector('meta[name="csrf-token"]');

        if (el) {
          el = el.getAttribute('content');
        }

        return el;
      };

      $httpProvider.interceptors.push(function() {
        return {
         'request': function(config) {
            if ( 'string' === typeof(config.url) && config.url.indexOf('/api') === 0 ) {
              var headers = config.headers;
              var token   = getToken();

              if (token) {
                headers['X-CSRF-TOKEN']     = token;
                headers['X-Requested-With'] = 'XMLHttpRequest';
              }
            }

            return config;
          }
        };
      });
    }
  ]);
