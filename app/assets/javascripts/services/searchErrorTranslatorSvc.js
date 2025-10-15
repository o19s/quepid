'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .service('searchErrorTranslatorSvc', [
    function searchErrorTranslatorSvc() {
      var self = this;

      self.codeToString         = codeToString;
      self.formatCode           = formatCode;
      self.parseResponseObject  = parseResponseObject;

      var codes = {
        '100': 'Continue',
        '101': 'Switching Protocols',
        '102': 'Processing',
        '200': 'OK',
        '201': 'Created',
        '202': 'Accepted',
        '203': 'Non-Authoritative Information',
        '204': 'No Content',
        '205': 'Reset Content',
        '206': 'Partial Content',
        '207': 'Multi-Status',
        '300': 'Multiple Choices',
        '301': 'Moved Permanently',
        '302': 'Moved Temporarily',
        '303': 'See Other',
        '304': 'Not Modified',
        '305': 'Use Proxy',
        '307': 'Temporary Redirect',
        '308': 'Permanent Redirect',
        '400': 'Bad Request',
        '401': 'Unauthorized',
        '402': 'Payment Required',
        '403': 'Forbidden',
        '404': 'Not Found',
        '405': 'Method Not Allowed',
        '406': 'Not Acceptable',
        '407': 'Proxy Authentication Required',
        '408': 'Request Time-out',
        '409': 'Conflict',
        '410': 'Gone',
        '411': 'Length Required',
        '412': 'Precondition Failed',
        '413': 'Request Entity Too Large',
        '414': 'Request-URI Too Large',
        '415': 'Unsupported Media Type',
        '416': 'Requested Range Not Satisfiable',
        '417': 'Expectation Failed',
        '418': 'I\'m a teapot',
        '422': 'Unprocessable Entity',
        '423': 'Locked',
        '424': 'Failed Dependency',
        '425': 'Unordered Collection',
        '426': 'Upgrade Required',
        '428': 'Precondition Required',
        '429': 'Too Many Requests',
        '431': 'Request Header Fields Too Large',
        '500': 'Internal Server Error',
        '501': 'Not Implemented',
        '502': 'Bad Gateway',
        '503': 'Service Unavailable',
        '504': 'Gateway Time-out',
        '505': 'HTTP Version Not Supported',
        '506': 'Variant Also Negotiates',
        '507': 'Insufficient Storage',
        '509': 'Bandwidth Limit Exceeded',
        '510': 'Not Extended',
        '511': 'Network Authentication Required'
      };

      function codeToString (code) {
        if ( codes.hasOwnProperty(code) ) {
          return codes[code];
        } else {
          return 'Unknown Error';
        }
      }

      function formatCode (code) {
        if (code > 0) {
          return '[' + code + ': ' + self.codeToString(code) + ']';
        }
      }

      function parseResponseObject (response, inspectUrl, searchEngine) {
        

        var error = 'An unexpected error was returned: ';

        if ( response.status === -1 ) {
          error += 'You may have a typo in your URL';
          error += ' (<a href="https://github.com/o19s/quepid/wiki" target="_blank">Quepid Wiki</a> for more help).';
          error += ' If that is not the case, make sure that CORS is enabled in your config.';
        } 
        else if ( response.status === 429 && response.headers && response.headers('Retry-After') ) {
          error = 'Please wait ' + response.headers('Retry-After') + ' seconds before rerunning request.';
        }
        else {
          error +=  self.formatCode(response.status);

          if ( response.hasOwnProperty('statusText') ) {
            error += ' - ' + response.statusText;
          }

          if ( response.hasOwnProperty('reason') ) {
            error += ' - ' + response.reason;
          }

          if (response.data) {
            if ( angular.isObject(response.data.error) ) {
              error += ': ' + angular.toJson(response.data.error);
            } else if (response.data.error) {
              error += ': ' + response.data.error;
            }
          }
        }
        
        if (searchEngine === 'solr') {
          error += ' <br>One or more of your Solr queries failed to return results, please access your <a href="' +
                 inspectUrl +
                 '" target="_blank">Solr instance directly</a> to confirm Solr is accessible and to inspect the error.   If Solr responds, check if you have an ad blocker blocking your queries.  With Solr 8.4.1 and later you need to allow Quepid access to Solr.  Learn more <a href="https://github.com/o19s/quepid/wiki/Troubleshooting-Solr-and-Quepid#compatibility-with-nosniff" target="_blank">on the troubleshooting Solr wiki page</a>.';
        }

        return error;
      }
    }
  ]);
