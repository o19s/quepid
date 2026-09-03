'use strict';

 /*jslint latedef:false*/

/**
 * Multi-step wizard modal for configuring a new or existing case's search endpoint, static corpus,
 * import paths, and related options before entering the main queries UI.
 */

angular.module('QuepidApp')
  .controller('WizardModalCtrl', [
    '$rootScope', '$scope', '$quepidModalInstance', '$log', '$window', '$location',
    'WizardHandler',
    'settingsSvc', 'SettingsValidatorFactory',
    'docCacheSvc', 'queriesSvc', 'caseTryNavSvc', 'caseSvc', 'userSvc','searchEndpointSvc','mapperBasedSearchEngineSvc','caseCSVSvc','querySnapshotSvc',
    function (
      $rootScope, $scope, $quepidModalInstance, $log, $window, $location,
      WizardHandler,
      settingsSvc, SettingsValidatorFactory,
      docCacheSvc, queriesSvc, caseTryNavSvc, caseSvc, userSvc, searchEndpointSvc, mapperBasedSearchEngineSvc, caseCSVSvc, querySnapshotSvc
    ) {
      $log.debug('Init Wizard settings ctrl');
      
      $scope.cancel = function () {
        let confirm = $window.confirm('Are you sure you want to abandon this case?');
        if (confirm) {
          caseSvc.deleteCase(caseSvc.getSelectedCase()).then(function() {
            $quepidModalInstance.dismiss('cancel');
            $window.location.href = caseTryNavSvc.getQuepidRootUrl();
          });

        }
      };

      $scope.goToMapperWizard = function () {
        caseSvc.deleteCase(caseSvc.getSelectedCase()).then(function() {
          $quepidModalInstance.dismiss('cancel');
          $window.location = caseTryNavSvc.getQuepidRootUrl() + '/search_endpoints/mapper_wizard';
        });
      };

      $scope.isChrome = /Chrome/.test($window.navigator.userAgent);
      $scope.solrQueryResponseWriterCurlJson = [
        '{',
        '  "create-queryresponsewriter": {',
        '    "name": "json",',
        '    "class": "solr.JSONResponseWriter",',
        '    "content-type": "application/javascript; charset=UTF-8"',
        '  }',
        '}'
      ].join('\n');
      $scope.searchApiQueryPatternPlaceholder = '{ "query": "#$query##" }';
      $scope.shouldCreateNewSearchEndpointDefaultToOpen = false;
      $scope.shouldExistingSearchEndpointDefaultToOpen = false;
      $scope.searchEndpoints = [];
      $scope.isStaticCollapsed = true;
      $scope.addedStaticQueries = false;
      $scope.listOfStaticQueries = [];
      $scope.staticContent = {
        content: null,
        header: true,
        separator: ',',
        separatorVisible: false,
        result: null,
        import: {}
      };
            
      $scope.wizardSettingsModel = {};

      $scope.wizardSettingsModel.settingsId = function() {
        return settingsSvc.settingsId();
      };

      searchEndpointSvc.list()
       .then(function() {
         $scope.searchEndpoints = searchEndpointSvc.searchEndpoints; 
         $scope.hasStaticEndpoints = false;
         angular.forEach($scope.searchEndpoints, function(searchEndpoint) {
          if (searchEndpoint.searchEngine === 'static'){
            $scope.hasStaticEndpoints = true;
          }
        });
       });

      mapperBasedSearchEngineSvc.list()
       .then(function() {
         angular.forEach(mapperBasedSearchEngineSvc.engines, function(engine) {
           settingsSvc.registerMapperBasedSearchEngine(engine);
         });
         $scope.mapperBasedSearchEngines = mapperBasedSearchEngineSvc.engines;

         // updateSettingsDefaults() (called synchronously during controller init, see
         // below) may have already run before this async call resolved, e.g. when
         // deep-linking/reloading straight into a mapper-based engine like Vespa. In
         // that case pickSettingsToUse() fell back to the generic searchapi defaults
         // (see settingsSvc.pickSettingsToUse) because the engine wasn't registered
         // yet. Re-apply the engine-specific defaults now that they're available.
         if ($scope.pendingWizardSettings &&
             angular.isDefined($scope.pendingWizardSettings.searchEnginePreset) &&
             angular.isDefined(settingsSvc.defaultSettings[$scope.pendingWizardSettings.searchEnginePreset])) {
           // changeSearchEngine() resets searchUrl to the engine's default; preserve
           // whatever URL is already pending (e.g. from a deep-linked reload) instead.
           var urlBeforeRefresh = $scope.pendingWizardSettings.searchUrl;
           $scope.changeSearchEngine();
           if (angular.isDefined($location.search().searchUrl)) {
             $scope.pendingWizardSettings.searchUrl = urlBeforeRefresh;
           }
         }
       });

      $scope.listSearchEndpoints = function() {
        // we only want the search endpoint dialgue to default to open
        // if we are not reloading and have search endpoints.
        if (!angular.isDefined($location.search().searchEngine)){
          $scope.shouldCreateNewSearchEndpointDefaultToOpen = false;
        }
        return $scope.searchEndpoints;
      };

      // used when we first launch the wizard, and it handles reloading from http to https
      $scope.updateSettingsDefaults = function() {

        if (angular.isUndefined($scope.pendingWizardSettings)){
             // When we run the case wizard, we assume that you want to use our Solr based TMDB demo setup.
             // We then give you options to change from there.
             
             // If we are reloading, then use the new one we picked, otherwise
             // we default to Solr.
             let searchEngineToUse = null;
             if (angular.isDefined($location.search().searchEngine)){
               searchEngineToUse = $location.search().searchEngine;
             }
             else {
               searchEngineToUse = 'solr';
             }
             $scope.pendingWizardSettings = {
               searchEngine: searchEngineToUse,
               searchEnginePreset: searchEngineToUse
             };
             
             // Helps us distingush if we are using tmdb demo setup or no
             if (angular.isDefined($location.search().searchUrl)){
               $scope.pendingWizardSettings.searchUrl = $location.search().searchUrl;
             }
        }
        
        var settings = settingsSvc.pickSettingsToUse($scope.pendingWizardSettings.searchEngine, $scope.pendingWizardSettings.searchUrl);
        $scope.pendingWizardSettings.additionalFields         = settings.additionalFields;
        $scope.pendingWizardSettings.fieldSpec                = settings.fieldSpec;
        $scope.pendingWizardSettings.idField                  = settings.idField;
        $scope.pendingWizardSettings.searchEngine             = settings.searchEngine;
        $scope.pendingWizardSettings.apiMethod                = settings.apiMethod;
        $scope.pendingWizardSettings.customHeaders            = settings.customHeaders;
        $scope.pendingWizardSettings.headerType               = settings.headerType;
        $scope.pendingWizardSettings.queryParams              = settings.queryParams;
        $scope.pendingWizardSettings.titleField               = settings.titleField;
        $scope.pendingWizardSettings.urlFormat                = settings.urlFormat;    
        $scope.pendingWizardSettings.searchEndpointId         = null;
        $scope.pendingWizardSettings.proxyRequests            = settings.proxyRequests;
        $scope.pendingWizardSettings.basicAuthCredential      = settings.basicAuthCredential;
        $scope.pendingWizardSettings.mapperCode               = settings.mapperCode;

        
        var quepidStartsWithHttps = $location.protocol() === 'https';

        if ($scope.pendingWizardSettings.searchEngine === 'solr') {
          if (quepidStartsWithHttps === true){
            $scope.pendingWizardSettings.searchUrl = settings.secureSearchUrl;
          }
          else {
            $scope.pendingWizardSettings.searchUrl = settings.insecureSearchUrl;
          }
        }
        else {
          $scope.pendingWizardSettings.searchUrl = settings.searchUrl;
        }

        // if we have restarted the wizard, then grab the searchUrl, searchEngine, apiMethod,
        // and caseName from the params and override the default values.
        // We should pass this stuff in externally, not do it here.
        if (angular.isDefined($location.search().searchEngine)){
          var presetFromUrl = $location.search().searchEngine;
          $scope.pendingWizardSettings.searchEnginePreset = presetFromUrl;
          // For mapper-based tiles (e.g. 'vespa') the underlying searchEngine is
          // 'searchapi', not the preset id itself — resolve it the same way
          // changeSearchEngine()/changeSearchEndpoint() do, instead of clobbering
          // the already-resolved searchEngine (set above from `settings.searchEngine`)
          // back to the raw preset. Built-in engines have preset === searchEngine,
          // so this is a no-op for them.
          $scope.pendingWizardSettings.searchEngine = (settingsSvc.defaultSettings[presetFromUrl] &&
            settingsSvc.defaultSettings[presetFromUrl].searchEngine) || presetFromUrl;
        }
        if (angular.isDefined($location.search().searchUrl)){
          $scope.pendingWizardSettings.searchUrl = $location.search().searchUrl;
        }
        if (angular.isDefined($location.search().caseName)){
          $scope.pendingWizardSettings.caseName = $location.search().caseName;
        }
        if (angular.isDefined($location.search().apiMethod)){
          $scope.pendingWizardSettings.apiMethod = $location.search().apiMethod;
        }
        if (angular.isDefined($location.search().basicAuthCredential)){
          $scope.pendingWizardSettings.basicAuthCredential = $location.search().basicAuthCredential;
        }
        $scope.reset();
      };

      // used when you change a searchEndpoint that has already been set up, and then follow normal flow.
      $scope.changeSearchEndpoint = function() {
        var searchEndpointToUse = $scope.searchEndpoints.find(obj => obj.id === $scope.pendingWizardSettings.searchEndpointId);

        // From search endpoint - these are endpoint-specific settings
        $scope.pendingWizardSettings.searchEngine             = searchEndpointToUse.searchEngine;
        // Falls back to searchEngine for a plain endpoint; mapperBasedSearchEngineId
        // (e.g. 'vespa') is what distinguishes a mapper-based tile pick when set.
        $scope.pendingWizardSettings.searchEnginePreset       = searchEndpointToUse.mapperBasedSearchEngineId || searchEndpointToUse.searchEngine;
        $scope.pendingWizardSettings.searchUrl                = searchEndpointToUse.endpointUrl; // notice remapping
        $scope.pendingWizardSettings.apiMethod                = searchEndpointToUse.apiMethod;
        // Convert customHeaders to string if it's an object (from JSON serialization)
        $scope.pendingWizardSettings.customHeaders            = typeof searchEndpointToUse.customHeaders === 'object' && searchEndpointToUse.customHeaders !== null ?
          JSON.stringify(searchEndpointToUse.customHeaders, null, 2) :
          searchEndpointToUse.customHeaders;
        $scope.pendingWizardSettings.proxyRequests            = searchEndpointToUse.proxyRequests;
        $scope.pendingWizardSettings.basicAuthCredential      = searchEndpointToUse.basicAuthCredential;
        $scope.pendingWizardSettings.mapperCode               = searchEndpointToUse.mapperCode;
        $scope.pendingWizardSettings.testQuery                = searchEndpointToUse.testQuery;

        // Now grab default settings for the type of search endpoint you are using
        // These are display/query settings that have sensible defaults per search engine type.
        // Use the preset (e.g. 'vespa') rather than the raw searchEngine ('searchapi')
        // so mapper-based tiles get their own field mapping instead of the generic
        // searchapi defaults (fieldSpec/idField/titleField all null) — see the same
        // pattern in changeSearchEngine() above.
        var lookupKey = $scope.pendingWizardSettings.searchEnginePreset || $scope.pendingWizardSettings.searchEngine;
        var settings = settingsSvc.pickSettingsToUse(lookupKey, $scope.pendingWizardSettings.searchUrl);
        $scope.pendingWizardSettings.additionalFields         = settings.additionalFields;
        $scope.pendingWizardSettings.fieldSpec                = settings.fieldSpec;
        $scope.pendingWizardSettings.idField                  = settings.idField;
        $scope.pendingWizardSettings.titleField               = settings.titleField;

        // For searchapi endpoints, use the saved testQuery as the queryParams
        // This pre-populates the query pattern with what was saved in the search endpoint
        if (searchEndpointToUse.searchEngine === 'searchapi' && searchEndpointToUse.testQuery) {
          $scope.pendingWizardSettings.queryParams            = searchEndpointToUse.testQuery;
        } else {
          $scope.pendingWizardSettings.queryParams            = settings.queryParams;
        }

        $scope.reset();
      };
      
      // used when you swap radio buttons for the search engine.
      // Every radio (built-in or a mapper-based tile like Vespa) binds ng-model to
      // pendingWizardSettings.searchEnginePreset directly, and AngularJS applies that
      // model write before firing ng-change, so it's already the lookup key we need by
      // the time this runs. The looked-up settings' own searchEngine (e.g. 'searchapi'
      // for a mapper-based engine) is what actually gets persisted.
      $scope.changeSearchEngine = function() {

        if (angular.isUndefined($scope.pendingWizardSettings)){
            // When we run the case wizard, we assume that you want to use our Solr based TMDB demo setup.
            // We then give you options to change from there.
            $scope.pendingWizardSettings = angular.copy(settingsSvc.tmdbSettings['solr']);
        }
        var lookupKey = $scope.pendingWizardSettings.searchEnginePreset || $scope.pendingWizardSettings.searchEngine;
        var settings = settingsSvc.pickSettingsToUse(lookupKey, $scope.pendingWizardSettings.searchUrl);
        $scope.pendingWizardSettings.additionalFields         = settings.additionalFields;
        $scope.pendingWizardSettings.fieldSpec                = settings.fieldSpec;
        $scope.pendingWizardSettings.idField                  = settings.idField;
        $scope.pendingWizardSettings.searchEnginePreset       = lookupKey;
        $scope.pendingWizardSettings.searchEngine             = settings.searchEngine;
        $scope.pendingWizardSettings.apiMethod                = settings.apiMethod;
        $scope.pendingWizardSettings.customHeaders            = settings.customHeaders;
        $scope.pendingWizardSettings.headerType               = settings.headerType;
        $scope.pendingWizardSettings.queryParams              = settings.queryParams;
        $scope.pendingWizardSettings.titleField               = settings.titleField;
        $scope.pendingWizardSettings.urlFormat                = settings.urlFormat;
        $scope.pendingWizardSettings.proxyRequests            = settings.proxyRequests;
        $scope.pendingWizardSettings.basicAuthCredential      = settings.basicAuthCredential;
        $scope.pendingWizardSettings.mapperCode               = settings.mapperCode;
        $scope.pendingWizardSettings.supportsBasicAuth        = settings.supportsBasicAuth;
        // A known-good search term (e.g. Vespa's 'bm25') so ping-it/field-discovery gets
        // back a real matching document instead of a syntactically-valid-but-empty result
        // set — see MapperBasedSearchEngine#test_query. undefined for built-in engines,
        // which don't set this; validate() already falls back to a generic term then.
        $scope.pendingWizardSettings.testQuery                = settings.testQuery;
        
        $scope.isHeaderConfigCollapsed = true;

        var quepidStartsWithHttps = $location.protocol() === 'https';

        if ($scope.pendingWizardSettings.searchEngine === 'solr') {
          if (quepidStartsWithHttps === true){
            $scope.pendingWizardSettings.searchUrl = settings.secureSearchUrl;
          }
          else {
            $scope.pendingWizardSettings.searchUrl = settings.insecureSearchUrl;
          }
        }
        else {
          $scope.pendingWizardSettings.searchUrl = settings.searchUrl;
        }

        $scope.reset();
      };
      
      // used when you click the accordion for new search endpoint
      $scope.switchToCreateNewSearchEndpoint = function() {
       $scope.pendingWizardSettings.searchEndpointId = null;       
      };

      
               
      if (angular.isDefined($location.search().searchEngine)) {
        // Changing http(s), so we should be open.  
        if (angular.isDefined($location.search().existingSearchEndpoint)) {
          // We were on the Existing Search Endpoint
          $scope.shouldExistingSearchEndpointDefaultToOpen = true;
        }
        else {
          $scope.shouldCreateNewSearchEndpointDefaultToOpen = true;
        }
      }            
        
      
      $scope.validate       = validate;
      $scope.skipValidation = skipValidation;
      $scope.readyToContinue = readyToContinue;
      $scope.setupDefaults  = setupDefaults;
      $scope.linkToSearchEndpointUrl  = linkToSearchEndpointUrl;
      $scope.submit         = submit;
      $scope.reset          = reset;
      $scope.resetUrlValid  = resetUrlValid;
      $scope.checkTLSForSearchEngineUrl = checkTLSForSearchEngineUrl;
      $scope.updateSettingsDefaults();
      $scope.validateHeaders = validateHeaders;
      $scope.validateProxyApiMethod = validateProxyApiMethod;
      $scope.changeProxySetting = changeProxySetting;

      // Toggle via a function so the write lands on the controller scope.
      // An inline `ng-click="x = !x"` would shadow the primitive on the
      // ng-if child scope, breaking programmatic opens (showProxyHelpIfNeeded).
      $scope.toggleHeaderConfig = function () {
        $scope.isHeaderConfigCollapsed = !$scope.isHeaderConfigCollapsed;
      };

      $scope.searchFields   = [];
      $scope.createSnapshot = createSnapshot;

      $scope.extractSolrConfigApiUrl = function(searchUrl) {
        return searchUrl.substring(0, searchUrl.lastIndexOf('/')) + '/config';
      };

      function reset() {
        $scope.validating = false;
        $scope.urlValid = $scope.urlInvalid = $scope.invalidHeaders = $scope.invalidProxyApiMethod = false;
        $scope.mapperInvalid = false;
        $scope.mapperErrorMessage = null;
        
        
        $scope.showTLSChangeWarning = false; // hope this doesn't cause a flicker.'
        if ($scope.pendingWizardSettings.searchUrl){
          $scope.checkTLSForSearchEngineUrl();
        }
      }
      
      function linkToSearchEndpointUrl() {
        if ($scope.pendingWizardSettings.proxyRequests === true){
          return caseTryNavSvc.getQuepidProxyUrl($scope.pendingWizardSettings.searchEndpointId) + $scope.pendingWizardSettings.searchUrl;
        }
        else {
          return $scope.pendingWizardSettings.searchUrl;
        }
      }
      
      function resetUrlValid() {
        $scope.urlValid = false;
        $scope.invalidProxyApiMethod = false;
      }

      function submit() {
        if ($scope.urlValid) {
          WizardHandler.wizard().next();
        }
      }      
      
      function readyToContinue() {
        if ($scope.validating){
          return false;
        }
        if ($scope.pendingWizardSettings.searchEngine === 'static'){
          if ($scope.addedStaticQueries){
            return true;
          }
          else {
            return false;
          }
        }
        return true;
      }

      function skipValidation() {
        var validator = new SettingsValidatorFactory($scope.pendingWizardSettings);

        setupDefaults(validator);

        WizardHandler.wizard().next();
      }

      function validate (justValidate) {
        if (angular.isUndefined(justValidate)) {
          justValidate = false;
        }
        $scope.validating = true;
        $scope.urlValid = $scope.urlInvalid = false;
        $scope.mapperInvalid = false;

        // This logic maybe should live in Splainer Search if we wanted to support Splainer.io as well?

        $scope.showTLSChangeWarning = false;

        $scope.checkTLSForSearchEngineUrl();
        $scope.validateHeaders();
        $scope.validateProxyApiMethod();

        // exit early if we have the TLS issue, this really should be part of the below logic.
        // validator.validateTLS().then.validateURL().then....
        if ($scope.showTLSChangeWarning || $scope.invalidHeaders || $scope.invalidProxyApiMethod ){
          $scope.validating = false;
          return;
        }
        
        // copy the settings so we don't change the underlying settings during
        // the validation process.
        var settingsForValidation  = angular.copy($scope.pendingWizardSettings);
        if ($scope.pendingWizardSettings.searchEngine === 'static'){
          // We pretend to be Solr for validating the URL.
          settingsForValidation.searchEngine = 'solr';
        }
        else if ($scope.pendingWizardSettings.searchEngine === 'searchapi'){
          var testQuery = $scope.pendingWizardSettings.testQuery;
          var queryParams = $scope.pendingWizardSettings.queryParams || '';

          if (testQuery && testQuery.trim().length > 0) {
            // Test Query always holds a complete, ready-to-send query — either mirrored
            // from an existing endpoint (changeSearchEndpoint()) or a mapper-based
            // preset's own schema-agnostic match-all default (e.g. Vespa's
            // "select * from sources * where true", see
            // MapperBasedSearchEngine#test_query) — so send it as-is, bypassing
            // queryParams entirely. A real per-case query built by substituting some
            // term into queryParams' #$query## placeholder would only surface fields
            // from docs matching that specific term/field structure, and wouldn't
            // generalize to a real user's own data.
            settingsForValidation.args = testQuery;
          }
          else if (queryParams.indexOf('#$query##') !== -1) {
            // No test query configured (e.g. a hand-typed new Custom Search API
            // endpoint): validate the real template, substituting a generic non-empty
            // placeholder term so strict engines (Vespa YQL rejects `contains ""`)
            // don't reject an empty one. splainer-search itself would otherwise hydrate
            // #$query## with an empty string during this pre-real-query validation.
            settingsForValidation.args = queryParams.replace(/#\$query##/g, 'test');
          }
          else {
            settingsForValidation.args = queryParams;
          }
        
          try {
            /*jshint evil:true */
            /* jshint undef: false */
            console.log('About to evaluate mapper code...');
            
            // Alternative approach: Use Function constructor which runs in non-strict mode
            // and has access to global scope
            var mapperFunction = new Function(settingsForValidation.mapperCode);
            mapperFunction.call(window);
            
            // The functions should now be available on the window object
            if (window.numberOfResultsMapper) {
              numberOfResultsMapper = window.numberOfResultsMapper;
            }
            if (window.docsMapper) {
              docsMapper = window.docsMapper;
            }
            /*jshint evil:false */
            /* jshint undef: true */
            
      
          } catch (evalError) {
            console.error('Error evaluating mapper code:', evalError);
            console.error('Error stack:', evalError.stack);
            $scope.mapperInvalid = true;
            $scope.mapperErrorMessage = 'Mapper code evaluation failed: ' + evalError.message;
            $scope.validating = false;
            return; // Exit early if eval fails
          }
          
          /* jshint undef: false */
          if (typeof numberOfResultsMapper === 'undefined') {
            console.error('numberOfResultsMapper is undefined after evaluation');
            $scope.mapperInvalid = true;
            $scope.mapperErrorMessage = 'You need to define a "numberOfResultsMapper"';
          }
          else {
            console.log('numberOfResultsMapper defined successfully:', numberOfResultsMapper);
            settingsForValidation.numberOfResultsMapper = numberOfResultsMapper; 
          }
          
          if (typeof docsMapper === 'undefined') {
            console.error('docsMapper is undefined after evaluation');
            $scope.mapperInvalid = true;
            $scope.mapperErrorMessage = 'You need to define a "docsMapper"';
          }
          else {
            console.log('docsMapper defined successfully:', docsMapper);
            settingsForValidation.docsMapper = docsMapper; 
          }
          /* jshint undef: true */
          
          console.log('=== END MAPPER CODE DEBUG ===');
          
          // This is an example of what the above mapper code might look like.
          
          //eval(kode);
          // settingsForValidation.docsMapper = function(data){    
          //   let docs = [];
          //   for (let doc of data) {
          //     docs.push ({
          //       id: doc.publication_id,
          //       title: doc.title,
          //       score: doc.score,
          //       publish_date_int: doc.publish_date_int
          //     });
          //   }
          //   return docs;
          // };
        }
        
        if (settingsForValidation.proxyRequests === true){
          // Pass in the Quepid specific proxy url
          settingsForValidation.proxyUrl = caseTryNavSvc.getQuepidProxyUrl(settingsForValidation.searchEndpointId);
        }
        var validator = new SettingsValidatorFactory(settingsForValidation);
      
        validator.validateUrl()
        .then(function () {
          $scope.validating = false;
          $scope.urlValid   = true;

          if (!$scope.mapperInvalid) {
            setupDefaults(validator);

            if (!justValidate) {
              $scope.pendingWizardSettings.searchUrl = settingsForValidation.searchUrl;
              WizardHandler.wizard().next();
            }
          }
        }, function (error) {
          if (error.toString().startsWith('Error: MapperError')){
            $scope.mapperInvalid = true;
            $scope.mapperErrorMessage = error.toString();
          }
          else {
            $scope.urlInvalid = true;
            showProxyHelpIfNeeded();
          }              
          $scope.validating = false;
        });
      }

      function showProxyHelpIfNeeded () {
        if (
          $scope.urlInvalid &&
          !$scope.pendingWizardSettings.proxyRequests &&
          $scope.pendingWizardSettings.searchEngine !== 'static'
        ) {
          $scope.isHeaderConfigCollapsed = true;
        }
      }

      function validateHeaders () {
        $scope.invalidHeaders = false;

        if (
          $scope.pendingWizardSettings.customHeaders && $scope.pendingWizardSettings.customHeaders.length > 0) {
          try {
            JSON.parse($scope.pendingWizardSettings.customHeaders);
          } catch (e) {
            $scope.invalidHeaders = true;
            $scope.validating = false;
          }
        }

      }
      
      function changeProxySetting () {
        if ($scope.pendingWizardSettings.proxyRequests === true){
          $scope.showTLSChangeWarning = false;
        }
        validateProxyApiMethod();
        checkTLSForSearchEngineUrl();
      }
      
      function validateProxyApiMethod () {
        $scope.invalidProxyApiMethod = false;
        if ($scope.pendingWizardSettings.proxyRequests === true){
          if (
            $scope.pendingWizardSettings.apiMethod && $scope.pendingWizardSettings.apiMethod === 'JSONP') {
            
              $scope.invalidProxyApiMethod = true;
              $scope.validating = false;
          }
        }
      }


      function checkTLSForSearchEngineUrl () {
        if ($scope.pendingWizardSettings.proxyRequests === true){
          $scope.showTLSChangeWarning = false;
        }
        else {
          $scope.showTLSChangeWarning = caseTryNavSvc.needToRedirectQuepidProtocol($scope.pendingWizardSettings.searchUrl);
          
          if ($scope.showTLSChangeWarning){         
            var resultsTuple = caseTryNavSvc.swapQuepidUrlTLS();
            
            $scope.quepidUrlToSwitchTo = resultsTuple[0];
            $scope.protocolToSwitchTo = resultsTuple[1];

            
            $scope.quepidUrlToSwitchTo = caseTryNavSvc.appendQueryParams($scope.quepidUrlToSwitchTo, `showWizard=true` +
              `&searchEngine=${$scope.pendingWizardSettings.searchEngine}` +
              `&searchUrl=${$scope.pendingWizardSettings.searchUrl}` +
              `&caseName=${$scope.pendingWizardSettings.caseName}` +
              `&apiMethod=${$scope.pendingWizardSettings.apiMethod}` +
              `&basicAuthCredential=${$scope.pendingWizardSettings.basicAuthCredential}`);            
          }
        }
      }


      function setupDefaults(validator) {
        $scope.validating   = false;
        $scope.urlValid     = true;
        $scope.mapperInvalid= false;
        $scope.mapperErrorMessage = null;
        $scope.searchFields = validator.fields;
        $scope.idFields     = validator.idFields;            

        // Since the defaults are being overridden by the editableSettings(),
        // we need to restore the TMDB demo settings if that matches our URL for the next screen.
        // Look up by searchEnginePreset (falling back to searchEngine) so a dynamic engine
        // preset like Vespa restores its own field mappings, not generic searchapi ones.
        var lookupKey     = $scope.pendingWizardSettings.searchEnginePreset || $scope.pendingWizardSettings.searchEngine;
        var newUrl        = $scope.pendingWizardSettings.searchUrl;

        var settingsToUse = settingsSvc.pickSettingsToUse(lookupKey, newUrl);
        
        
        $scope.pendingWizardSettings.idField          = settingsToUse.idField;
        $scope.pendingWizardSettings.titleField       = settingsToUse.titleField;
        $scope.pendingWizardSettings.additionalFields = settingsToUse.additionalFields;
        
      }

      $scope.validateFieldSpec = validateFieldSpec;
      function validateFieldSpec () {
        $scope.validating           = true;
        $scope.idFieldRequired      = false;
        $scope.titleFieldRequired   = false;

        if ( angular.isUndefined($scope.pendingWizardSettings.idField) ||
          $scope.pendingWizardSettings.idField === '' ||
          $scope.pendingWizardSettings.idField === null
        ) {
          $scope.idFieldRequired = true;
        }

        if ( angular.isUndefined($scope.pendingWizardSettings.titleField) ||
          $scope.pendingWizardSettings.titleField === '' ||
          $scope.pendingWizardSettings.titleField === null
        ) {
          $scope.titleFieldRequired = true;
        }

        if ( $scope.titleFieldRequired || $scope.idFieldRequired) {
          $scope.validating = false;
          return;
        }
        var customTitle = $scope.searchFields.indexOf($scope.pendingWizardSettings.titleField) === -1;
        var customId    = $scope.searchFields.indexOf($scope.pendingWizardSettings.idField) === -1;

        // Skip the custom field warning for searchapi since fields are defined by the mapper code
        if ((customId || customTitle) && $scope.pendingWizardSettings.searchEngine !== 'searchapi') {
          var confirm = $window.confirm('You are using a custom field for the title or ID (could be a typo), are you sure you want to continue?');

          if ( !confirm ) {
            $scope.validating = false;
            return;
          }
        }

        var additionalFields = [];
        angular.forEach($scope.pendingWizardSettings.additionalFields, function(field) {
          additionalFields.push(field.text);
        });
        additionalFields = additionalFields.join(', ');

        var fields = [
          'id:' + $scope.pendingWizardSettings.idField,
          'title:' + $scope.pendingWizardSettings.titleField,
          additionalFields
        ];

        fields = fields.filter(function (n) { return n !== undefined && n !== ''; });
        $scope.pendingWizardSettings.fieldSpec = fields.join(', ');

        $scope.validating = false;
        WizardHandler.wizard().next();
      }

      $scope.loadFields = loadFields;
      function loadFields (query) {
        var autocompleteList = [];
        var _query = query.trim().toLowerCase();
        var modified = false;
        var modifierText = '';

        var allowedModifiers = [
            'media:',
            'thumb:',
            'image:'
        ];

        for (var i = 0; i < allowedModifiers.length; i++) {
          var modifier = allowedModifiers[i];

          if (_query.startsWith(modifier)) {
            _query = _query.substr(modifier.length);
            modifierText = modifier;
            modified = true;
            break;
          }
        }

        angular.forEach($scope.searchFields, function(field) {
          if ( field.toLowerCase().indexOf(_query) !== -1 ) {
            autocompleteList.push({ text: modified ? modifierText + field : field });
          }
        });

        return autocompleteList;
      }

      $scope.$watch('wizardSettingsModel.settingsId()', function() {
        // Reinit our pending settings from the service
        var tempSearchUrl = $scope.pendingWizardSettings.searchUrl;
        var tempApiMethod = $scope.pendingWizardSettings.apiMethod;
        var tempQueryParams = $scope.pendingWizardSettings.queryParams;
        var tempSearchEngine = $scope.pendingWizardSettings.searchEngine;
        angular.merge($scope.pendingWizardSettings, settingsSvc.editableSettings());
        $scope.pendingWizardSettings.searchUrl = tempSearchUrl;
        $scope.pendingWizardSettings.apiMethod = tempApiMethod;
        $scope.pendingWizardSettings.queryParams = tempQueryParams;
        $scope.pendingWizardSettings.searchEngine = tempSearchEngine;
        $scope.pendingWizardSettings.newQueries = [];

        if(userSvc.getUser().completedCaseWizard===false){
          $scope.pendingWizardSettings.caseName = 'Movies Search';
          // should we be setting up more here?
        } else {
          $log.info('Skipping welcome step for case wizard');
          WizardHandler.wizard().goTo(1);
        }

        $scope.pendingWizardSettings.deleteQuery = function(index) {
          $scope.pendingWizardSettings.newQueries.splice(index, 1);
        };

        $scope.pendingWizardSettings.addQuery = function(text) {
          // This function is called on "Continue" which mean that the text
          // might actually be empty, so we shouldn't add that to the queries
          // list. Or even when the user clicks on "Add Query".
          if ( text !== '' && text !== null && text !== undefined ) {
            var length = $scope.pendingWizardSettings.newQueries.length;
            var unique = true;
            for(var i=0; i<length; i++){
              if(text === $scope.pendingWizardSettings.newQueries[i].queryString){
                unique =false;
              }
            }
            if(unique){
              var obj = {};
              obj.queryString = text;
              $scope.pendingWizardSettings.newQueries.push(obj);
              $scope.pendingWizardSettings.text='';//Reset text in input box
            }
          }
        };
        
        $scope.pendingWizardSettings.addQueryStaticQueries = function() {
          angular.forEach($scope.listOfStaticQueries, function(queryText) {
            $scope.pendingWizardSettings.addQuery(queryText);
          });                    
         };

        // pass pending settings on to be saved
        $scope.pendingWizardSettings.submit = function() {
          if ($scope.savingFinish) {
            return;
          }

          $log.debug('Submitting settings (from wizard modal)');

          // if we aren't using a demo, then lets finalize our queryParams with our best guess
         if (!settingsSvc.demoSettingsChosen($scope.pendingWizardSettings.searchEngine, $scope.pendingWizardSettings.searchUrl)){
           if ($scope.pendingWizardSettings.searchEngine === 'os' || $scope.pendingWizardSettings.searchEngine === 'es'){
             $scope.pendingWizardSettings.queryParams = $scope.pendingWizardSettings.queryParams.replace('REPLACE_ME', $scope.pendingWizardSettings.titleField);
           }
           
           if ($scope.pendingWizardSettings.searchEngine === 'solr'){
             $scope.pendingWizardSettings.queryParams = settingsSvc.defaultSettings['solr'].queryParams;             
           }
         }

          $scope.finishSaveError = null;
          $scope.savingFinish = true;
          return settingsSvc.update($scope.pendingWizardSettings)
          .then(function() {
            var latestSettings = settingsSvc.editableSettings();
            docCacheSvc.invalidate();
            docCacheSvc.update(latestSettings);
            queriesSvc.changeSettings(caseTryNavSvc.getCaseNo(), latestSettings);

            //Change Case Name (Separate from Dev settings)
            if(typeof($scope.pendingWizardSettings.caseName) !=='undefined' && $scope.pendingWizardSettings.caseName !== ''){
              caseSvc.renameCase(caseSvc.getSelectedCase(), $scope.pendingWizardSettings.caseName);
            }
            var length = $scope.pendingWizardSettings.newQueries.length;
            
            var queries = [];
            for(var queryIndex = 0; queryIndex < length; queryIndex++){
              var query  = $scope.pendingWizardSettings.newQueries[queryIndex];

              if( typeof(query.queryString) !== 'undefined' && query.queryString !== '' ) {
                //var q = queriesSvc.createQuery(query.queryString);
                //queriesSvc.persistQuery(q);
                queries.push(queriesSvc.createQuery(query.queryString));
              }
            }
            
            queriesSvc.persistQueries(queries);

            $rootScope.currentUser.shownIntroWizard();

            $quepidModalInstance.close();
          })
          .catch(function(response) {
            $log.error('Wizard finish save failed', response);
            $scope.finishSaveError = formatFinishSaveError(response);
          })
          .finally(function() {
            $scope.savingFinish = false;
          });
        };

        function formatFinishSaveError(response) {
          var data = response && response.data;
          var detail = '';

          if (angular.isString(data)) {
            detail = data;
          } else if (angular.isObject(data)) {
            if (data.error) {
              detail = data.error;
            } else {
              var messages = [];
              angular.forEach(data, function(value, key) {
                if (angular.isArray(value)) {
                  messages.push(key + ' ' + value.join(', '));
                } else if (angular.isString(value)) {
                  messages.push(value);
                }
              });
              detail = messages.join('. ');
            }
          }

          if (detail) {
            return 'Could not save your case settings: ' + detail + '. Please click Finish to try again.';
          }
          return 'Could not save your case settings. Please click Finish to try again.';
        }
      });

      $scope.close = function() {
        $quepidModalInstance.dismiss('cancel');
      };
      
      function createSnapshot() {
        $scope.staticContent.import.loading = true;
        $scope.isStaticCollapsed = false;
                
        angular.forEach($scope.staticContent.result, function(doc) {
          if (!$scope.listOfStaticQueries.includes(doc['Query Text'])){
            $scope.listOfStaticQueries.push(doc['Query Text']);
          }
        });
            
        querySnapshotSvc.importSnapshotsToSpecificCase($scope.staticContent.result, caseTryNavSvc.getCaseNo())
          .then(function () {
            const keys = Object.keys(querySnapshotSvc.snapshots);
            const snapshotId = keys[keys.length - 1];
            
            // The magic URL for looking up queries as if we talked to a REAL Solr search engine ;-).
            $scope.pendingWizardSettings.searchUrl = `${caseTryNavSvc.getQuepidRootUrl()}/api/cases/${caseTryNavSvc.getCaseNo()}/snapshots/${snapshotId}/search`;
            
            $scope.isStaticCollapsed = false;
            $scope.addedStaticQueries = true;
            //var result = {
            //  success: true,
            //  message: 'Static Data imported successfully!',
            // };
            $scope.staticContent.import.loading = false;
          }, function () {
            //var result = {
              // error: true,
              // message: 'Could not import static data successfully! Please try again.',
            //};

            $scope.staticContent.import.loading = false;
          });
      }
      $scope.checkStaticHeaders = checkStaticHeaders;
      function checkStaticHeaders () {

        var headers = $scope.staticContent.content.split('\n')[0];
        headers = headers.split($scope.staticContent.separator);

        var expectedHeaders = [
          'Query Text', 'Doc ID', 'Doc Position'
        ];
        console.log(headers);
        console.log(expectedHeaders);

        if (!caseCSVSvc.arrayContains(headers, expectedHeaders)) {
          let alert = 'Required headers mismatch! Please make sure you have the correct headers in your file (check for correct spelling and capitalization): ';
          alert += '<br /><strong>';
          alert += expectedHeaders.join(',');
          alert += '</strong>';

          $scope.staticContent.import.alert = alert;
        }
        
        const documentHeaders = headers.filter(item => !expectedHeaders.includes(item));
        const containsSpace = documentHeaders.some(item => item.trim().includes(' '));
        if (containsSpace) {
          let alert = 'Document field names may not contain whitespace: ';
          alert += '<br /><strong>';
          alert += documentHeaders.join(',');
          alert += '</strong>';

          $scope.staticContent.import.alert = alert;
        }
        
        
      }
      
      $scope.$watch('staticContent.content', function (newVal, oldVal) {
        if (newVal !== oldVal) {
          $scope.staticContent.import.alert = undefined;
          $scope.staticContent.result = caseCSVSvc.fixObjectKeys($scope.staticContent.result);
          checkStaticHeaders();          
        }
      }, true);
    }
  ]);
