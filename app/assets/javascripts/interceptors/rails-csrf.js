'use strict';

angular.module('ng-rails-csrf', [] )
  .config(['$provide', function($provide) {
    // This method lets us modify the default behavior of $templateRequest to hit a 
    // custom Rails controller "pages_controller" to look up templates.  Previously we 
    // used the angular-rails-templates project to include all the templates in the app.js 
    // file that was produced by Sprockets.  However, we don't have this with Propshaft.
    // If we can go BACK to including the templates in the big javascript load, well, that avoids
    // all the sha stamping of the files.
    
    // node_module provided files start with these paths
    const patterns = ['angularUtils', 'uib'];
    $provide.decorator('$templateRequest', ['$delegate', function($delegate) {
      // Store the original handleRequestFn method
      var originalHandleRequestFn = $delegate;
     
      // Override the handleRequestFn method
      $delegate = function(tpl, ignoreRequestError) {
        
        var internalResource = patterns.some(pattern => tpl.startsWith(pattern));

        if (!internalResource) {
          // Route to custom Rails end point for reading in the file.
          tpl = '/angularjs/' + tpl;
        }
  
        // Call the original handleRequestFn with the modified tpl
        return originalHandleRequestFn(tpl, ignoreRequestError);
      };
  
      return $delegate;
    }]);
  }])
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
            if ( 'string' === typeof(config.url) && config.url.indexOf('api/') >= 0 ) {
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
