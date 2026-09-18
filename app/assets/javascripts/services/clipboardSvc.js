'use strict';

angular.module('QuepidApp')
  .service('clipboardSvc', [
    '$q',
    function clipboardSvc($q) {
      // navigator.clipboard needs a secure context (HTTPS or localhost). The core case
      // page can be plain HTTP (Solr JSONP forces it), so fall back to the classic
      // execCommand('copy') technique when it's unavailable.
      this.copy = function (text) {
        text = text || '';

        if (navigator.clipboard && navigator.clipboard.writeText) {
          return $q.when(navigator.clipboard.writeText(text));
        }

        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();

        var deferred = $q.defer();
        try {
          document.execCommand('copy');
          deferred.resolve();
        }
        catch (e) {
          deferred.reject(e);
        }
        finally {
          document.body.removeChild(textarea);
        }
        return deferred.promise;
      };
    }
  ]);
