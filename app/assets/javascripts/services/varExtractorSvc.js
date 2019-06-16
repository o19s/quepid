'use strict';

angular.module('QuepidApp')
  // Given a solr query string, etract all the curator vars
  .service('varExtractorSvc', [
    function varExtractorSvc() {
      var extractParam = function (match) {
        var paramSingle = /##([^#]*)##/;
        var matchedParam = paramSingle.exec(match);
        if (matchedParam && matchedParam.length >= 2) {
          return matchedParam[1];
        } else {
          return null;
        }
      };

      var stripMagicQueryVar = function(queryParams) {
        return queryParams.replace(/#\$query##/g, '');
      };

      var stripMagicKeywordVars = function(queryParams) {
        return queryParams.replace(/#\$keyword\d+##/g, '');
      };

      this.extract = function(queryParams) {
        var varNames    = [];
        var qpStripped  = stripMagicQueryVar(queryParams);
        qpStripped      = stripMagicKeywordVars(qpStripped);
        var paramsRe    = /##[^#]*?##/g;
        var matches     = qpStripped.match(paramsRe);

        if (matches) {
          angular.forEach(matches, function(match) {
            var varName = extractParam(match);
            if (varName) {
              varNames.push(varName);
            }
          });
        }
        return varNames;
      };
    }
  ]);
