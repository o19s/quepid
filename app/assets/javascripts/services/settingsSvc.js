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
          queryParams:  [
            '&defType=edismax',
            '&qf=text_all',
            '&indent=on',
            '&q=#$query##',
            '&tie=1.0',
          ].join('\n'),

          escapeQuery:      true,
          fieldSpec:        'id:id, title:title',
          idField:          'id',
          titleField:       'title',
          additionalFields: ['overview','cast','thumb:poster_path'],
          numberOfRows:     10,
          searchEngine:     'solr',
          searchUrl:        'http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select',
          urlFormat:        'http(s?)://yourdomain.com:8983/<index>/select',
        },
        es: {
          queryParams:  [
            '{',
            '  "query": {',
            '    "multi_match": {',
            '      "query": "#$query##",',
            '      "type": "best_fields",',
            '      "fields": [',
            '        "title^10",',
            '        "overview",',
            '        "cast"',
            '      ]',
            '    }',
            '  }',
            '}',
          ].join('\n'),

          escapeQuery:       true,
          fieldSpec:         'id:_id, title:title',
          idField:           '_id',
          titleField:        'title',
          additionalFields:  ['overview','cast','thumb:poster_path'],
          numberOfRows:      10,
          searchEngine:      'es',
          searchUrl:         'http://quepid-elasticsearch.dev.o19s.com:9206/tmdb/_search',
          urlFormat:         'http(s?)://yourdomain.com:9200/<index>/_search',
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
        // Make sure we have current settings and that the try we selected
        // actually exists, otherwise the selectedTry will be null.
        return currSettings !== null && currSettings.selectedTry !== null;
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

      // Save off any modified settings, generating a
      // new try.
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
        sentData.search_url      = settingsToSave.searchUrl;

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

      // Update a set of settings in place, which doesn't generate
      // a new try.
      this.update = function(settingsToSave) {
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
        var currTryNo = caseTryNavSvc.getTryNo();

        sentData.curatorVars     = settingsToSave.selectedTry.curatorVarsDict();
        sentData.escape_query    = settingsToSave.escapeQuery;
        sentData.fields          = settingsToSave.createFieldSpec().fields;
        sentData.field_spec      = settingsToSave.fieldSpec;
        sentData.number_of_rows  = settingsToSave.numberOfRows;
        sentData.query_params    = settingsToSave.selectedTry.queryParams;
        sentData.search_engine   = settingsToSave.searchEngine;
        sentData.search_url      = settingsToSave.searchUrl;

        return $http.put('/api/cases/' + currCaseNo + '/tries/' + currTryNo, sentData)
          .then(function() {

            // Broadcast that settings for case have been updated
            var args = {
              caseNo:   currCaseNo,
              lastTry:  settingsToSave.selectedTry
            };
            broadcastSvc.send('settings-updated', args);

            // navigate to what was selected in case try no changed
            caseTryNavSvc.navigateTo({tryNo: settingsToSave.selectedTry.tryNo});
          });
      };

      this.setSettings = function (tries, selectedTryNo) {
        currSettings = new Settings(tries);
        currSettings.selectTry(selectedTryNo);
      };
    }
  ]);
