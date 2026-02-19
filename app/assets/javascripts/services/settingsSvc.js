'use strict';
/*jslint latedef:false*/

angular.module('QuepidApp')
  .service('settingsSvc', [
    '$http',
    '$q',
    'caseTryNavSvc',
    'SettingsFactory',
    'broadcastSvc',
    function settingsSvc(
      $http,
      $q,
      caseTryNavSvc,
      SettingsFactory,
      broadcastSvc
    ) {

      /* jshint ignore:start */
      // Used by the wizard for any search engine.
      this.defaultSettings = {
        solr: {
          queryParams: [
            'q=#$query##',
            '&tie=1.0',
          ].join('\n'),

          escapeQuery: true,
          customHeaders: '',
          headerType: 'None',
          apiMethod: 'JSONP',
          fieldSpec: 'id:id',
          idField: 'id',
          titleField: '',
          additionalFields: [],
          numberOfRows: 10,
          searchEngine: 'solr',
          // perfect world we wouldn't have this here and we would instead populate with urlFormat instead.
          insecureSearchUrl: 'http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select',
          secureSearchUrl: 'https://quepid-solr.dev.o19s.com/solr/tmdb/select',
          urlFormat: 'http(s?)://yourdomain.com:8983/<index>/select',
          proxyRequests: false,
          basicAuthCredential: ''
        },
        es: {
          queryParams: [
            '{',
            '  "query": {',
            '    "multi_match": {',
            '      "query": "#$query##",',
            '      "type": "best_fields",',
            '      "fields": ["REPLACE_ME"]',
            '    }',
            '  }',
            '}',
          ].join('\n'),

          escapeQuery: true,
          apiMethod: 'POST',
          customHeaders: '',
          headerType: 'None',
          fieldSpec: 'id:_id',
          idField: '_id',
          titleField: '',
          additionalFields: [],
          numberOfRows: 10,
          searchEngine: 'es',
          searchUrl: 'http://quepid-elasticsearch.dev.o19s.com:9206/tmdb/_search',
          urlFormat: 'http(s?)://yourdomain.com:9200/<index>/_search',
          proxyRequests: false,
          basicAuthCredential: ''
        },
        os: {
          queryParams: [
            '{',
            '  "query": {',
            '    "multi_match": {',
            '      "query": "#$query##",',
            '      "fields": ["*"]',
            '    }',
            '  }',
            '}',
          ].join('\n'),

          escapeQuery: true,
          apiMethod: 'POST',
          customHeaders: '',
          fieldSpec: 'id:_id',
          idField: '_id',
          titleField: '',
          additionalFields: [],
          numberOfRows: 10,
          searchEngine: 'os',
          searchUrl: 'https://quepid-opensearch.dev.o19s.com:9000/tmdb/_search',
          urlFormat: 'http(s?)://yourdomain.com:9200/<index>/_search',
          proxyRequests: false,
          basicAuthCredential: 'reader:reader'
        },
        vectara: {
          queryParams: [
            '{',
            '  "query": [',
            '     {',
            '       "query": "#$query##",',
            '       "start": 0,',
            '       "numResults": 10,',
            '       "corpusKey": [{',
            '          "corpusId": 1,',
            '          "lexicalInterpolationConfig": {',
            '            "lambda": 0.025',
            '          },',
            '          "dim": []',
            '       }]',
            '     }',
            '  ]',
            '}'
          ].join('\n'),

          escapeQuery: true,
          apiMethod: 'POST',
          headerType: 'Custom',
          customHeaders: [
            '{',
            '  "customer-id": "YOUR_CUSTOMER_ID",',
            '  "x-api-key": "YOUR_API_KEY"',
            '}'
          ].join('\n'),
          fieldSpec: 'id:id',
          idField: 'id',
          titleField: 'title',
          additionalFields: [],
          numberOfRows: 10,
          searchEngine: 'vectara',
          searchUrl: 'https://api.vectara.io/v1/query',
          urlFormat: 'https://api.vectara.io/v1/query',
          proxyRequests: false,
          basicAuthCredential: ''
        },
        algolia: {
          queryParams: [
            '{',
              '"query": "#$query##",',
              '"clickAnalytics": true,',
              '"getRankingInfo": true,',
              '"restrictSearchableAttributes": [],',
              '"enableReRanking": true,',
              '"attributesToHighlight": [],',
              '"page": 0,',
              '"hitsPerPage": 10',
            '}'
          ].join('\n'),
          escapeQuery: true,
          apiMethod: 'POST',
          headerType: 'Custom',
          customHeaders: [
            '{',
            '  "x-algolia-application-id": "OKF83BFQS4",',
            '  "x-algolia-api-key": "2ee1381ed11d3fe70b60605b1e2cd3f4"',
            '}'
          ].join('\n'),
          idField: 'objectID',
          titleField: 'title',
          additionalFields: ['overview', 'cast', 'thumb:poster_path'],
          numberOfRows: 10,
          searchEngine: 'algolia',
          searchUrl: 'https://OKF83BFQS4-dsn.algolia.net/1/indexes/movies_demo_quepid/query',
          urlFormat: 'https://<APPLICATION-ID>-dsn.algolia.net/1/indexes/<index>/query',
          proxyRequests: true,
          basicAuthCredential: ''
        },
        static: {
          queryParams: [
            'q=#$query##'
          ].join('\n'),
          escapeQuery: true,
          headerType: 'None',
          apiMethod: 'GET',
          customHeaders: '',
          fieldSpec: 'id:id',
          idField: 'id',
          titleField: '',
          additionalFields: [],
          numberOfRows: 10,
          searchEngine: 'static',
          proxyRequests: false
          // no searchUrl or urlFormat because it's code generated!
        },
        searchapi: {
          // a lot of these defaults can probably be removed in the future
          // when we don't create the searchapi in the wizard.
          // queryParams: [
          //   '{',
          //   '  "query": "#$query##"',
          //   '}'
          // ].join('\n'),
          escapeQuery: true,
          apiMethod: 'POST',
          headerType: 'None',
          customHeaders: '',
          fieldSpec: null,
          idField: null,
          titleField: null,
          additionalFields: [],
          numberOfRows: 10,
          searchEngine: 'searchapi',
          searchUrl: 'https://example.com/api/search',
          urlFormat: null,
          proxyRequests: true,
          mapperCode: [
            'numberOfResultsMapper = function(data){',
            '  return data.length;',
            '};',
            '',
            'docsMapper = function(data){',
            '  let docs = [];',
            '  for (let doc of data) {',
            '    docs.push ({',
            '      id: doc.publication_id,',
            '      title: doc.title,',
            '    });',
            '  }',
            '  return docs;',
            '};'
          ].join('\n'),
          // no searchUrl or urlFormat because it's code generated!
        }
      };

      // used by the wizard for TMDB demo search engine settings.
      // Not all seachEngines have a TMDB demo set up.
      this.tmdbSettings = {
        solr: {
          queryParams: [
            'q=#$query##',
            '&defType=edismax',
            '&qf=text_all',
            '&pf=title',
            '&tie=1.0',
            '&bf=vote_average',
          ].join('\n'),

          escapeQuery: true,
          customHeaders: '',
          headerType: 'None',
          apiMethod: 'JSONP',
          fieldSpec: 'id:id, title:title',
          idField: 'id',
          titleField: 'title',
          additionalFields: ['overview', 'cast', 'thumb:poster_path'],
          numberOfRows: 10,
          searchEngine: 'solr',
          insecureSearchUrl: 'http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select',
          secureSearchUrl: 'https://quepid-solr.dev.o19s.com/solr/tmdb/select',
          urlFormat: 'http(s?)://yourdomain.com:8983/<index>/select',
          proxyRequests: false,
          basicAuthCredential: ''
        },
        es: {
          queryParams: [
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

          escapeQuery: true,
          apiMethod: 'POST',
          customHeaders: '',
          headerType: 'None',
          fieldSpec: 'id:_id, title:title',
          idField: '_id',
          titleField: 'title',
          additionalFields: ['overview', 'cast', 'thumb:poster_path'],
          numberOfRows: 10,
          searchEngine: 'es',
          searchUrl: 'http://quepid-elasticsearch.dev.o19s.com:9206/tmdb/_search',
          urlFormat: 'http(s?)://yourdomain.com:9200/<index>/_search',
          proxyRequests: false,
          basicAuthCredential: ''
        },
        os: {
          queryParams: [
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

          escapeQuery: true,
          apiMethod: 'POST',
          fieldSpec: 'id:_id, title:title',
          idField: '_id',
          titleField: 'title',
          additionalFields: ['overview', 'cast', 'thumb:poster_path'],
          numberOfRows: 10,
          searchEngine: 'os',
          searchUrl: 'https://quepid-opensearch.dev.o19s.com:9000/tmdb/_search',
          urlFormat: 'http(s?)://yourdomain.com:9200/<index>/_search',
          customHeaders: '',
          proxyRequests: false,
          basicAuthCredential: 'reader:reader'
        }
      };

      /* jshint ignore:end */

      var Settings = SettingsFactory;
      var currSettings = null;
      
      this.supportLookupById = function(searchEngine) {
        let supportLookupById = true;
        if (searchEngine === 'vectara'){
          supportLookupById = false;
        }
        else if (searchEngine === 'searchapi'){
          supportLookupById = false;
        }
        return supportLookupById;
      };

      this.demoSettingsChosen = function(searchEngine, newUrl) {
        var useTMDBDemoSettings = false;
        if (angular.isUndefined(this.tmdbSettings[searchEngine])) {
          useTMDBDemoSettings = false; // yes this isn't actually needed.
        }
        else {
          if (searchEngine === 'solr') {
            if (newUrl === null || angular.isUndefined(newUrl)) {
              useTMDBDemoSettings = true;
            }
            // We actually have separate demos for Solr based on http and https urls.
            else if (newUrl === this.tmdbSettings['solr'].insecureSearchUrl || newUrl === this.tmdbSettings['solr'].secureSearchUrl) {
              useTMDBDemoSettings = true;
            }
            else {
              useTMDBDemoSettings = false;
            }
          }
          else {
            if (newUrl === this.tmdbSettings[searchEngine].searchUrl) {
              useTMDBDemoSettings = true;
            }
            else {
              useTMDBDemoSettings = false;
            }
          }
        }
        return useTMDBDemoSettings;
      };

      this.pickSettingsToUse = function(searchEngine, newUrl) {
        if (this.demoSettingsChosen(searchEngine, newUrl)) {
          return angular.copy(this.tmdbSettings[searchEngine]);
        }
        else {
          return angular.copy(this.defaultSettings[searchEngine]);
        }
      };

      this.getDemoSettings = function(searchEngine){
        return angular.copy(this.tmdbSettings[searchEngine]);
    };

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
        var caseNo = caseTryNavSvc.getCaseNo();
        var tryNo = caseTryNavSvc.getTryNo();

        var path = 'api/cases/' + caseNo + '/tries';
        return $http.get(path)
          .then(function(response) {
            currSettings = new Settings(response.data.tries);
            currSettings.selectTry(tryNo);

            var args = {
              caseNo: caseNo,
              settings: currSettings
            };
            broadcastSvc.send('settings-changed', args);

          }, function() {
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
        if (currSettings !== null) {
          var settings = angular.copy(currSettings);

          if (tryToUse === undefined) {
            tryToUse = settings.selectedTry;
            settings.selectTry(tryToUse.tryNo);
          }

          settings.escapeQuery = tryToUse.escapeQuery;
          settings.apiMethod = tryToUse.apiMethod;
          settings.customHeaders = tryToUse.customHeaders || '';
          settings.fieldSpec = tryToUse.fieldSpec;
          settings.numberOfRows = tryToUse.numberOfRows;
          settings.queryParams = tryToUse.queryParams;
          settings.searchEngine = tryToUse.searchEngine;
          settings.searchEndpointId = tryToUse.searchEndpointId;
          settings.searchUrl = tryToUse.searchUrl;
          settings.proxyRequests = tryToUse.proxyRequests;
          settings.basicAuthCredential = tryToUse.basicAuthCredential;
          settings.mapperCode = tryToUse.mapperCode;
          settings.options = tryToUse.options;

          // TODO: Store type in db?...
          // See if we have "ApiKey" in our custom headers, which tells us we have an API Key.
          var headersToCheck = settings.customHeaders && typeof settings.customHeaders === 'object' 
            ? JSON.stringify(settings.customHeaders) 
            : '';
          
          settings.headerType = headersToCheck.includes('ApiKey') ? 'API Key'
            : headersToCheck.length > 0 ? 'Custom' : 'None';


          return settings;
        } else {
          return {};
        }
      };

      this.applicableSettings = function() {
        if (currSettings !== null) {
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

        var currCaseNo = caseTryNavSvc.getCaseNo();

        var payload = {};
        var payloadTry = {};
        var payloadSearchEndpoint = {};
        payload.try = payloadTry;
        payload.search_endpoint = payloadSearchEndpoint;
        payload.parent_try_number = settingsToSave.selectedTry.tryNo; // track the parent try for ancestry
        payload.curator_vars = settingsToSave.selectedTry.curatorVarsDict();

        // We create the default name on the server side
        //payloadTry.name            = settingsToSave.selectedTry.name;

        payloadTry.escape_query = settingsToSave.escapeQuery;
        payloadTry.field_spec = settingsToSave.fieldSpec;
        payloadTry.number_of_rows = settingsToSave.numberOfRows;
        payloadTry.query_params = settingsToSave.selectedTry.queryParams;

        // Either we are changing to a different, existing search endpoint
        if (settingsToSave.searchEndpointId){
          payloadTry.search_endpoint_id = settingsToSave.searchEndpointId;
        }
        // Or we are creating a new one.
        else {
          payloadSearchEndpoint.search_engine = settingsToSave.searchEngine;
          payloadSearchEndpoint.endpoint_url = settingsToSave.searchUrl;
          payloadSearchEndpoint.api_method = settingsToSave.apiMethod;
          payloadSearchEndpoint.custom_headers = settingsToSave.customHeaders;
          payloadSearchEndpoint.basic_auth_credential = settingsToSave.basicAuthCredential;
          payloadSearchEndpoint.mapper_code = settingsToSave.mapperCode;
          payloadSearchEndpoint.proxy_requests = settingsToSave.proxyRequests;
        }

        return $http.post('api/cases/' + currCaseNo + '/tries', payload)
          .then(function(response) {
            var tryJson = response.data;
            var newTry = currSettings.addTry(tryJson);
            currSettings.selectTry(newTry.tryNo);

            // Broadcast that settings for case have been updated
            var args = {
              caseNo: currCaseNo,
              lastTry: newTry
            };
            broadcastSvc.send('settings-updated', args);

            // navigate to what was selected in case try no changed
            caseTryNavSvc.navigateTo({ tryNo: newTry.tryNo });
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

        // Not sure why we have this.  Handoff from wizard requires it though.
        settingsToSave.selectedTry.apiMethod = settingsToSave.apiMethod;
        settingsToSave.selectedTry.queryParams = settingsToSave.queryParams;

        // post up
        // (1) searchUrl
        // (2) fieldSpec
        // (3) possibly edited query params
        // (4) possibly modified curator vars
        // probably could be a bit more restful
        // Note that we map between camelCase in JS and snake_case in API here.
        var currCaseNo = caseTryNavSvc.getCaseNo();
        var currTryNo = caseTryNavSvc.getTryNo();

        // because this is only called at the end of the case creation wizard
        // we don't have a sentData.name = settingsToSave.selectedTry.name
        // for completeness we should.   If we enable more edit of existing try
        // tries are odd, cause we pretty much only create new ones!

        var payload = {};
        var payloadTry = {};
        payload.try = payloadTry;

        payload.parent_try_number = settingsToSave.selectedTry.tryNo;
        payload.curator_vars = settingsToSave.selectedTry.curatorVarsDict();

        // We create the default name on the server side
        //payloadTry.name            = settingsToSave.selectedTry.name;

        payloadTry.escape_query = settingsToSave.escapeQuery;
        payloadTry.field_spec = settingsToSave.fieldSpec;
        payloadTry.number_of_rows = settingsToSave.numberOfRows;
        payloadTry.query_params = settingsToSave.selectedTry.queryParams;

        // Either we are using an existing search endpoint
        if (settingsToSave.searchEndpointId){
          payloadTry.search_endpoint_id = settingsToSave.searchEndpointId;
        }
        // Or we are creating a new one.
        else {
          var payloadSearchEndpoint = {};
          payloadSearchEndpoint.search_engine = settingsToSave.searchEngine;
          payloadSearchEndpoint.endpoint_url = settingsToSave.searchUrl;
          payloadSearchEndpoint.api_method = settingsToSave.apiMethod;
          payloadSearchEndpoint.custom_headers = settingsToSave.customHeaders;
          payloadSearchEndpoint.basic_auth_credential = settingsToSave.basicAuthCredential;
          payloadSearchEndpoint.mapper_code = settingsToSave.mapperCode;
          payloadSearchEndpoint.proxy_requests = settingsToSave.proxyRequests;
          payload.search_endpoint = payloadSearchEndpoint;
        }

        return $http.put('api/cases/' + currCaseNo + '/tries/' + currTryNo, payload)
          .then(function() {

            // Broadcast that settings for case have been updated
            var args = {
              caseNo: currCaseNo,
              lastTry: settingsToSave.selectedTry
            };
            broadcastSvc.send('settings-updated', args);

            // navigate to what was selected in case try no changed
            caseTryNavSvc.navigateTo({ tryNo: settingsToSave.selectedTry.tryNo });
          });
      };

      this.setSettings = function(tries, selectedTryNo) {
        currSettings = new Settings(tries);
        currSettings.selectTry(selectedTryNo);
      };
    }
  ]);
