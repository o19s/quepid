'use strict';

 /*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('WizardModalCtrl', [
    '$rootScope', '$scope', '$uibModalInstance', '$log', '$window', '$q', '$location',
    'WizardHandler',
    'settingsSvc', 'SettingsValidatorFactory',
    'docCacheSvc', 'queriesSvc', 'caseTryNavSvc', 'caseSvc', 'userSvc',
    function (
      $rootScope, $scope, $uibModalInstance, $log, $window, $q, $location,
      WizardHandler,
      settingsSvc, SettingsValidatorFactory,
      docCacheSvc, queriesSvc, caseTryNavSvc, caseSvc, userSvc
    ) {
      $log.debug('Init Wizard settings ctrl');
      $scope.wizardSettingsModel = {};

      $scope.wizardSettingsModel.settingsId = function() {
        return settingsSvc.settingsId();
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
        $scope.pendingWizardSettings.queryParams              = settings.queryParams;
        $scope.pendingWizardSettings.titleField               = settings.titleField;
        $scope.pendingWizardSettings.urlFormat                = settings.urlFormat;

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
        $scope.pendingWizardSettings.queryParams              = settings.queryParams;
        $scope.pendingWizardSettings.titleField               = settings.titleField;
        $scope.pendingWizardSettings.urlFormat                = settings.urlFormat;

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
//          $scope.pendingWizardSettings.queryParams = settingsSvc.defaults[$scope.pendingWizardSettings.searchEngine].queryParams;
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

      $scope.validate       = validate;
      $scope.skipValidation = skipValidation;
      $scope.setupDefaults  = setupDefaults;
      $scope.submit         = submit;
      $scope.reset          = reset;
      $scope.resetUrlValid  = resetUrlValid;
      $scope.checkTLSForSearchEngineUrl = checkTLSForSearchEngineUrl;
      $scope.updateSettingsDefaults();
      $scope.validateHeaders = validateHeaders;
      $scope.searchFields   = [];


      $scope.extractSolrConfigApiUrl = function(searchUrl) {
        return searchUrl.substring(0, searchUrl.lastIndexOf('/')) + '/config';
      };


      function reset() {
        $scope.validating = false;
        $scope.urlValid = $scope.urlInvalid = $scope.invalidHeaders = false;
        //$scope.pendingWizardSettings = angular.copy(settingsSvc.tmdbSettings['solr']);
        // when you reset back to Solr, we actually don't have a url due to a glitch in picking the right one, sigh.
        if ($scope.pendingWizardSettings.searchUrl){
          $scope.checkTLSForSearchEngineUrl();
        }
      }

      function resetUrlValid() {
        $scope.urlValid =false;
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

        // exit early if we have the TLS issue, this really should be part of the below logic.
        // validator.validateTLS().then.validateURL().then....
        if ($scope.showTLSChangeWarning || $scope.invalidHeaders){
          return;
        }

        var validator = new SettingsValidatorFactory($scope.pendingWizardSettings);
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

        if ($scope.pendingWizardSettings.searchEngine !== 'solr'&&
          $scope.pendingWizardSettings.customHeaders.length > 0) {
          try {
            JSON.parse($scope.pendingWizardSettings.customHeaders);
          } catch (e) {
            $scope.invalidHeaders = true;
            $scope.validating = false;
          }
        }

      }

      function checkTLSForSearchEngineUrl () {

        $scope.showTLSChangeWarning = caseTryNavSvc.needToRedirectQuepidProtocol($scope.pendingWizardSettings.searchUrl)
        
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
        // make sure the default id, title, and additional fields are set
        // if the URL is still set as the default

        var searchEngine  = $scope.pendingWizardSettings.searchEngine;
        var newUrl        = $scope.pendingWizardSettings.searchUrl;

        var settingsToUse = settingsSvc.pickSettingsToUse(searchEngine, newUrl);

        $scope.pendingWizardSettings.idField          = settingsToUse.idField;
        $scope.pendingWizardSettings.titleField       = settingsToUse.titleField;
        $scope.pendingWizardSettings.additionalFields = settingsToUse.additionalFields;
        $scope.pendingWizardSettings.queryParams      = settingsToUse.queryParams;

        // Make sure to track what you might have picked
        $scope.pendingWizardSettings.apiMethod        = validator.apiMethod;
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
        angular.merge($scope.pendingWizardSettings, settingsSvc.editableSettings());
        $scope.pendingWizardSettings.searchUrl = tempSearchUrl;
        $scope.pendingWizardSettings.apiMethod = tempApiMethod;
        $scope.pendingWizardSettings.queryParams = tempQueryParams;
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

            var queryPromise = function(q) {
              return queriesSvc.persistQuery(q);
            };

            var createPromises = [];

            for(var queryIndex = 0; queryIndex < length; queryIndex++){
              query = $scope.pendingWizardSettings.newQueries[queryIndex];

              if( typeof(query.queryString) !== 'undefined' && query.queryString !== '' ) {
                var q = queriesSvc.createQuery(query.queryString);

                createPromises.push(queryPromise(q));
              }
            }

            $q.all(createPromises).then( () => {
              queriesSvc.searchAll();
            });


            $rootScope.currentUser.shownIntroWizard();


            $uibModalInstance.close();
          });
        };
      });

      $scope.close = function() {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
