'use strict';

 /*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('WizardModalCtrl', [
    '$rootScope', '$scope', '$uibModalInstance', '$log', '$window', '$location',
    'WizardHandler',
    'settingsSvc', 'SettingsValidatorFactory',
    'docCacheSvc', 'queriesSvc', 'caseTryNavSvc', 'caseSvc', 'userSvc','searchEndpointSvc','caseCSVSvc','querySnapshotSvc',
    function (
      $rootScope, $scope, $uibModalInstance, $log, $window, $location,
      WizardHandler,
      settingsSvc, SettingsValidatorFactory,
      docCacheSvc, queriesSvc, caseTryNavSvc, caseSvc, userSvc, searchEndpointSvc, caseCSVSvc, querySnapshotSvc
    ) {
      $log.debug('Init Wizard settings ctrl');
      
      $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

      
      $scope.isStaticCollapsed = true;
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
       });
       
      $scope.listSearchEndpoints = function() {
        return $scope.searchEndpoints;
      };

      // used when we first launch the wizard, and it handles reloading from http to https
      $scope.updateSettingsDefaults = function() {

        if (angular.isUndefined($scope.pendingWizardSettings)){
             // When we run the case wizard, we assume that you want to use our Solr based TMDB demo setup.
             // We then give you options to change from there.
             $scope.pendingWizardSettings = angular.copy(settingsSvc.tmdbSettings['solr']);
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

        //$scope.isHeaderConfigCollapsed = true;
        
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
          $scope.pendingWizardSettings.searchEngine = $location.search().searchEngine;
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
        $scope.reset();
      };

      // used when you change a searchEndpoint that has already been set up, and then follow normal flow.
      $scope.changeSearchEndpoint = function() {
        var searchEndpointToUse = $scope.searchEndpoints.find(obj => obj.id === $scope.pendingWizardSettings.searchEndpointId);
      
        // From search endpoint
        $scope.pendingWizardSettings.searchEngine             = searchEndpointToUse.searchEngine;
        $scope.pendingWizardSettings.searchUrl                = searchEndpointToUse.endpointUrl; // notice remapping
        $scope.pendingWizardSettings.apiMethod                = searchEndpointToUse.apiMethod;
        $scope.pendingWizardSettings.customHeaders            = searchEndpointToUse.customHeaders;
        
        // Now grab default settings for the type of search endpoint you are using
        var settings = settingsSvc.pickSettingsToUse($scope.pendingWizardSettings.searchEngine, $scope.pendingWizardSettings.searchUrl);         
        $scope.pendingWizardSettings.additionalFields         = settings.additionalFields;
        $scope.pendingWizardSettings.fieldSpec                = settings.fieldSpec;
        $scope.pendingWizardSettings.idField                  = settings.idField;
        $scope.pendingWizardSettings.queryParams              = settings.queryParams;
        $scope.pendingWizardSettings.titleField               = settings.titleField;
        $scope.pendingWizardSettings.proxyRequests            = settings.proxyRequests;
        $scope.pendingWizardSettings.basicAuthCredential      = settings.basicAuthCredential;

        
        $scope.reset();
      };
      
      // used when you swap radio buttons for the search engine.
      $scope.changeSearchEngine = function() {

        if (angular.isUndefined($scope.pendingWizardSettings)){
            // When we run the case wizard, we assume that you want to use our Solr based TMDB demo setup.
            // We then give you options to change from there.
            $scope.pendingWizardSettings = angular.copy(settingsSvc.tmdbSettings['solr']);
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
        $scope.pendingWizardSettings.proxyRequests            = settings.proxyRequests;
        $scope.pendingWizardSettings.basicAuthCredential      = settings.basicAuthCredential;        
        
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
        //else if ($scope.pendingWizardSettings.searchEngine === 'static') {
        //  $scope.isHeaderConfigCollapsed = false;
          //$scope.pendingWizardSettings.searchUrl = "/search";
          //}
        else {
          $scope.pendingWizardSettings.searchUrl = settings.searchUrl;
        }

        $scope.reset();
      };
      
      // used when you click the accordion for new search endpoint
      $scope.switchToCreateNewSearchEndpoint = function() {
       $scope.pendingWizardSettings.searchEndpointId = null;
       
      };
      
      $scope.validate       = validate;
      $scope.skipValidation = skipValidation;
      $scope.setupDefaults  = setupDefaults;
      $scope.submit         = submit;
      $scope.reset          = reset;
      $scope.resetUrlValid  = resetUrlValid;
      $scope.checkTLSForSearchEngineUrl = checkTLSForSearchEngineUrl;
      $scope.updateSettingsDefaults();
      $scope.validateHeaders = validateHeaders;
      $scope.validateProxyApiMethod = validateProxyApiMethod;
      $scope.searchFields   = [];
      $scope.createSnapshot = createSnapshot;

      $scope.extractSolrConfigApiUrl = function(searchUrl) {
        return searchUrl.substring(0, searchUrl.lastIndexOf('/')) + '/config';
      };

      function reset() {
        $scope.validating = false;
        $scope.urlValid = $scope.urlInvalid = $scope.invalidHeaders = $scope.invalidProxyApiMethod = false;
        
        $scope.showTLSChangeWarning = false; // hope this doesn't cause a flicker.'
        if ($scope.pendingWizardSettings.searchUrl){
          $scope.checkTLSForSearchEngineUrl();
        }
      }

      function resetUrlValid() {
        $scope.urlValid =false;
        $scope.invalidProxyApiMethod =false;
      }

      function submit() {
        if ($scope.urlValid) {
          WizardHandler.wizard().next();
        }
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

        // This logic maybe should live in Splainer Search if we wanted to support Splainer.io as well?

        $scope.showTLSChangeWarning = false;

        $scope.checkTLSForSearchEngineUrl();
        $scope.validateHeaders();
        
        $scope.validateProxyApiMethod();
        
        if ($scope.pendingWizardSettings.proxyRequests === "true"){
          $scope.pendingWizardSettings.searchUrl = "http://localhost:3000/proxy/fetch?url=" + $scope.pendingWizardSettings.searchUrl;
        }
        

        // exit early if we have the TLS issue, this really should be part of the below logic.
        // validator.validateTLS().then.validateURL().then....
        if ($scope.showTLSChangeWarning || $scope.invalidHeaders || $scope.invalidProxyApiMethod){
          return;
        }
        var settingsForValidation  = $scope.pendingWizardSettings;
        if ($scope.pendingWizardSettings.searchEngine === 'static'){
          // We pretend to be Solr for validating the URL.
          settingsForValidation = angular.copy($scope.pendingWizardSettings);
          settingsForValidation.searchEngine = 'solr';
        }
        else if ($scope.pendingWizardSettings.searchEngine === 'searchapi'){
          // we map to our response parser to use.
          settingsForValidation = angular.copy($scope.pendingWizardSettings);
          //settingsForValidation.searchEngine = $scope.pendingWizardSettings.responseParser;
          settingsForValidation.args = $scope.pendingWizardSettings.queryParams;
        }
        
        var validator = new SettingsValidatorFactory(settingsForValidation);
      
        validator.validateUrl()
        .then(function () {

          setupDefaults(validator);
          
          if (!justValidate) {
            
            WizardHandler.wizard().next();
          }
        }, function () {
          $scope.urlInvalid = true;
          $scope.validating = false;
        });
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
      
      function validateProxyApiMethod () {
        $scope.invalidProxyApiMethod = false;
        if ($scope.pendingWizardSettings.proxyRequests === "true"){
          if (
            $scope.pendingWizardSettings.apiMethod && $scope.pendingWizardSettings.apiMethod === 'JSONP') {
            
              $scope.invalidProxyApiMethod = true;
              $scope.validating = false;
          }
        }

      }

      function checkTLSForSearchEngineUrl () {
        $scope.showTLSChangeWarning = caseTryNavSvc.needToRedirectQuepidProtocol($scope.pendingWizardSettings.searchUrl);
        
        if ($scope.showTLSChangeWarning){
         
          var resultsTuple = caseTryNavSvc.swapQuepidUrlTLS();
          
          $scope.quepidUrlToSwitchTo = resultsTuple[0];
          $scope.protocolToSwitchTo = resultsTuple[1];
                    
          $scope.quepidUrlToSwitchTo = $scope.quepidUrlToSwitchTo + '?searchEngine=' + $scope.pendingWizardSettings.searchEngine + '&searchUrl=' + $scope.pendingWizardSettings.searchUrl + '&showWizard=true&caseName=' + $scope.pendingWizardSettings.caseName + '&apiMethod=' + $scope.pendingWizardSettings.apiMethod;
        }
      }


      function setupDefaults(validator) {
        $scope.validating   = false;
        $scope.urlValid     = true;
        $scope.searchFields = validator.fields;
        $scope.idFields     = validator.idFields;

        // Since the defaults are being overridden by the editableSettings(),
        // we need to restore the TMDB demo settings if that matches our URL for the next screen.
        var searchEngine  = $scope.pendingWizardSettings.searchEngine;
        var newUrl        = $scope.pendingWizardSettings.searchUrl;
        if (settingsSvc.demoSettingsChosen(searchEngine, newUrl)){
          var settingsToUse = settingsSvc.getDemoSettings($scope.pendingWizardSettings.searchEngine);
          $scope.pendingWizardSettings.idField          = settingsToUse.idField;
          $scope.pendingWizardSettings.titleField       = settingsToUse.titleField;
          $scope.pendingWizardSettings.additionalFields = settingsToUse.additionalFields;
          $scope.pendingWizardSettings.queryParams      = settingsToUse.queryParams;
        }
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

        if (customId || customTitle) {
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
          $log.debug('Submitting settings (from wizard modal)');

          // if we aren't using a demo, then lets finalize our queryParams with our title field.
         if (!settingsSvc.demoSettingsChosen($scope.pendingWizardSettings.searchEngine, $scope.pendingWizardSettings.searchUrl)){
           if ($scope.pendingWizardSettings.searchEngine === 'os' || $scope.pendingWizardSettings.searchEngine === 'es'){
             $scope.pendingWizardSettings.queryParams = $scope.pendingWizardSettings.queryParams.replace('REPLACE_ME', $scope.pendingWizardSettings.titleField);
           }
         }

          settingsSvc.update($scope.pendingWizardSettings)
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
            var query = null;
            
            for(var queryIndex = 0; queryIndex < length; queryIndex++){
              query = $scope.pendingWizardSettings.newQueries[queryIndex];

              if( typeof(query.queryString) !== 'undefined' && query.queryString !== '' ) {
                var q = queriesSvc.createQuery(query.queryString);
                queriesSvc.persistQuery(q);
              }
            }

            $rootScope.currentUser.shownIntroWizard();

            $uibModalInstance.close();
          });
        };
      });

      $scope.close = function() {
        $uibModalInstance.dismiss('cancel');
      };
      
      function createSnapshot() {
          $scope.staticContent.import.loading = true;
          $scope.isStaticCollapsed = false;
          
          $scope.listOfStaticQueries = [];
          angular.forEach($scope.staticContent.result, function(doc) {
            if (!$scope.listOfStaticQueries.includes(doc['Query Text'])){
              $scope.listOfStaticQueries.push(doc['Query Text']);
            }
          });
             
          querySnapshotSvc.importSnapshotsToSpecificCase($scope.staticContent.result, caseTryNavSvc.getCaseNo())
            .then(function () {
              const keys = Object.keys(querySnapshotSvc.snapshots);
              const snapshotId = keys[keys.length - 1];
                            
              console.log($location.absUrl)     ;         
              $scope.pendingWizardSettings.searchUrl = `${$location.protocol()}://${$location.host()}:${$location.port()}/api/cases/${caseTryNavSvc.getCaseNo()}/snapshots/${snapshotId}/search`;
              $scope.isStaticCollapsed = false;
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
          var alert = 'Required headers mismatch! Please make sure you have the correct headers in you file (check for correct spelling and capitalization): ';
          alert += '<br /><strong>';
          alert += expectedHeaders.join(',');
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
