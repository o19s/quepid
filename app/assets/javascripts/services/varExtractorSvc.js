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

      // A strong possibility that the keyword stuff never really
      // got traction, and could be removed.  Looking at tests in 
      // splainer-search, I think the idea was you could take a query and rework it
      // via $#keyword1## grabbing keyword in position 1, and $#keyword2## grabbing
      // keyword 2.  Think of it as some sort of experimentation tooling ;-).
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
