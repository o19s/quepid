'use strict';
/*jslint latedef:false*/

angular.module('QuepidApp')
  .service('settingsSvc', [
    '$http',
    '$q',
    'settingsIdValue',
    'caseTryNavSvc',
    'TryFactory', 'SettingsFactory',
    'broadcastSvc',
    function settingsSvc(
      $http,
      $q,
      settingsIdValue,
      caseTryNavSvc,
      TryFactory, SettingsFactory,
      broadcastSvc
    ) {
      this.defaults = {
        solr: {
          additional:      '',
          escapeQuery:     true,
          fieldSpec:       'id:id, title:title',
          idField:         'id',
          numberOfRows:    10,
          queryParams:     'q=#$query##',
          searchEngine:    'solr',
          searchUrl:       'http://quepid-solr.dev.o19s.com/solr/tmdb/select',
          titleField:      'title',
          urlFormat:       'http(s?)://yourdomain.com/<index>/select',
        },
        es: {
          queryParams:  [
            '{',
            '    "query": {',
            '        "query_string": {',
            '            "query": "#$query##"',
            '        }',
            '    }',
            '}',
          ].join('\n'),

          additional:      '',
          escapeQuery:     true,
          fieldSpec:       'id:_id, title:title',
          idField:         '_id',
          numberOfRows:    10,
          searchEngine:    'es',
          searchUrl:       'http://quepid-elasticsearch.dev.o19s.com:9200/tmdb/_search',
          titleField:      'title',
          urlFormat:       'http(s?)://yourdomain.com/<index>/_search',
        }
      };

      var Settings = SettingsFactory;
      var currSettings = null;

      this.setCaseTries = function(tries) {
        currSettings = new Settings(tries);
      };

      this.setCurrentTry = function(tryNo) {
        currSettings.selectTry(tryNo);
      };

      this.isTrySelected = function() {
        return currSettings !== null;
      };

      // An external change in case, we need
      // to rebootstrap ourselves
      this.bootstrap = function() {
        var caseNo  = caseTryNavSvc.getCaseNo();
        var tryNo   = caseTryNavSvc.getTryNo();

        var path = '/api/cases/' + caseNo + '/tries';
        return $http.get(path)
          .then(function(response) {
            currSettings = new Settings(response.data.tries);
            currSettings.selectTry(tryNo);

            var args = {
              caseNo:   caseNo,
              settings: currSettings
            };
            broadcastSvc.send('settings-changed', args);

          }, function(){
            caseTryNavSvc.notFound();
          });
      };

      this.settingsId = function() {
        if (currSettings !== null) {
          return currSettings.settingsId;
        }
        else {
          return -1;
        }
      };

      // Get a copy of the settings for later submission
      this.editableSettings = function(tryToUse) {
  			if(currSettings !== null){
  				var settings = angular.copy(currSettings);

          if (tryToUse === undefined) {
            tryToUse = settings.selectedTry;
            settings.selectTry(tryToUse.tryNo);
          }

          settings.escapeQuery   = tryToUse.escapeQuery;
          settings.fieldSpec     = tryToUse.fieldSpec;
          settings.numberOfRows  = tryToUse.numberOfRows;
          settings.queryParams   = tryToUse.queryParams;
          settings.searchEngine  = tryToUse.searchEngine;
          settings.searchUrl     = tryToUse.searchUrl;

          return settings;
  			} else {
  				return {};
  			}
      };

      this.applicableSettings = function() {
        if(currSettings !== null){
          return currSettings.selectedTry;
        } else {
          return {};
        }
      };

      this.deleteTry = function(tryNo) {
        return currSettings.deleteTry(tryNo);
      };

      this.duplicateTry = function(tryNo) {
        currSettings.duplicateTry(tryNo);
      };

      this.renameTry = function(tryNo, newName) {
        return currSettings.renameTry(tryNo, newName);
      };

      // Save off any modified settings
      this.save = function(settingsToSave) {
        if (settingsToSave.inError) {
          return $q(function(resolve) {
            resolve();
          });
        }

        settingsToSave.selectedTry.updateVars();
        // post up
        // (1) searchUrl
        // (2) fieldSpec
        // (3) possibly edited query params
        // (4) possibly modified curator vars
        // probably could be a bit more restful
        // Note that we map between camelCase in JS and snake_case in API here.
        var sentData = {};
        var currCaseNo = caseTryNavSvc.getCaseNo();

        sentData.curatorVars     = settingsToSave.selectedTry.curatorVarsDict();
        sentData.escape_query    = settingsToSave.escapeQuery;
        sentData.fields          = settingsToSave.createFieldSpec().fields;
        sentData.field_spec      = settingsToSave.fieldSpec;
        sentData.number_of_rows  = settingsToSave.numberOfRows;
        sentData.query_params    = settingsToSave.selectedTry.queryParams;
        sentData.search_engine   = settingsToSave.searchEngine;
        sentData.search_url       = settingsToSave.searchUrl;

        return $http.post('/api/cases/' + currCaseNo + '/tries', sentData)
          .then(function(response) {
            var tryJson = response.data;
            var newTry  = currSettings.addTry(tryJson);
            currSettings.selectTry(newTry.tryNo);

            // Broadcast that settings for case have been updated
            var args = {
              caseNo:   currCaseNo,
              lastTry:  newTry
            };
            broadcastSvc.send('settings-updated', args);

            // navigate to what was selected in case try no changed
            caseTryNavSvc.navigateTo({tryNo: newTry.tryNo});
          });
      };

      this.setSettings = function (tries, selectedTryNo) {
        currSettings = new Settings(tries);
        currSettings.selectTry(selectedTryNo);
      };
    }
  ]);
