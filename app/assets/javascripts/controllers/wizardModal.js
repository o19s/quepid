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



      // I don't think we need this as we look it up from the Try we create by default on the server side!
      // Except that it's also defined in settingsSvc.  Sigh.
      var defaultSettings = settingsSvc.defaults['solr'];

      $scope.pendingWizardSettings = angular.copy(defaultSettings);
      var quepidStartsWithHttps = $location.protocol() === 'https';
      if ($scope.pendingWizardSettings.searchEngine === 'es' || $scope.pendingWizardSettings.searchEngine === 'os') {
        $scope.pendingWizardSettings.searchUrl = defaultSettings.searchUrl;
      }
      else if (quepidStartsWithHttps === true){
        $scope.pendingWizardSettings.searchUrl = defaultSettings.secureSearchUrl;
      }
      else {
        $scope.pendingWizardSettings.searchUrl = defaultSettings.insecureSearchUrl;
      }

      $scope.wizardSettingsModel.settingsId = function() {
        return settingsSvc.settingsId();
      };

      $scope.updateSettingsDefaults = function() {
        var settings = settingsSvc.defaults[$scope.pendingWizardSettings.searchEngine];
        $scope.pendingWizardSettings.additionalFields         = settings.additionalFields;
        $scope.pendingWizardSettings.fieldSpec                = settings.fieldSpec;
        $scope.pendingWizardSettings.idField                  = settings.idField;
        $scope.pendingWizardSettings.searchEngine             = settings.searchEngine;
        $scope.pendingWizardSettings.apiMethod                = settings.apiMethod;
        $scope.pendingWizardSettings.queryParams              = settings.queryParams;
        $scope.pendingWizardSettings.titleField               = settings.titleField;
        $scope.pendingWizardSettings.urlFormat                = settings.urlFormat;
        var quepidStartsWithHttps = $location.protocol() === 'https';
        if ($scope.pendingWizardSettings.searchEngine === 'es' || $scope.pendingWizardSettings.searchEngine === 'os'){
          $scope.pendingWizardSettings.searchUrl = settings.searchUrl;
        }
        else if (quepidStartsWithHttps === true){
          $scope.pendingWizardSettings.searchUrl = settings.secureSearchUrl;
        }
        else {
          $scope.pendingWizardSettings.searchUrl = settings.insecureSearchUrl;
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
      $scope.searchFields   = [];

      // if we have restarted the wizard, then grab the searchUrl, searchEngine,
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

      $scope.extractSolrConfigApiUrl = function(searchUrl) {
        return searchUrl.substring(0, searchUrl.lastIndexOf('/')) + '/config';
      };


      function reset() {
        $scope.validating = false;
        $scope.urlValid = $scope.urlInvalid = false;
        $scope.checkTLSForSearchEngineUrl();

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

        // exit early if we have the TLS issue, this really should be part of the below logic.
        // validator.validateTLS().then.validateURL().then....
        if ($scope.showTLSChangeWarning){
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

      // Copied validateSearchEngineUrl from controllers/queryParams.js and renamed it checkTLSForSearchEngineUrl
      function checkTLSForSearchEngineUrl () {

        // Figure out if we need to reload Quepid on a different http/https port to match search engine.
        var quepidStartsWithHttps = $location.protocol() === 'https';
        var searchEngineStartsWithHttps = $scope.pendingWizardSettings.searchUrl.startsWith('https');

        if ((quepidStartsWithHttps.toString() === searchEngineStartsWithHttps.toString())){
          $scope.showTLSChangeWarning = false;
        }
        else {
          $scope.showTLSChangeWarning = true;

          $scope.quepidUrlToSwitchTo = $location.protocol() + '://' + $location.host() + $location.path();
          $scope.quepidUrlToSwitchTo = $scope.quepidUrlToSwitchTo + '?searchEngine=' + $scope.pendingWizardSettings.searchEngine + '&searchUrl=' + $scope.pendingWizardSettings.searchUrl + '&showWizard=true&caseName=' + $scope.pendingWizardSettings.caseName;

          if (searchEngineStartsWithHttps){
            $scope.protocolToSwitchTo = 'https';
            $scope.quepidUrlToSwitchTo = $scope.quepidUrlToSwitchTo.replace('http', 'https');
          }
          else {
            $scope.protocolToSwitchTo = 'http';
            $scope.quepidUrlToSwitchTo = $scope.quepidUrlToSwitchTo.replace('https', 'http');
          }

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
        var defaults      = settingsSvc.defaults[searchEngine];
        var newUrl        = $scope.pendingWizardSettings.searchUrl;
        var useDefaultSettings = false;
        if ($scope.pendingWizardSettings.searchEngine === 'solr'){
          if (newUrl === defaults.insecureSearchUrl || newUrl === defaults.secureSearchUrl ){
            useDefaultSettings = true;
          }
        }
        else {
          if (newUrl === defaults.searchUrl) {
            useDefaultSettings = true;
          }
        }

        if ( useDefaultSettings ) {
          $scope.pendingWizardSettings.idField          = defaults.idField;
          $scope.pendingWizardSettings.titleField       = defaults.titleField;
          $scope.pendingWizardSettings.additionalFields = defaults.additionalFields;
        } else {
          $scope.pendingWizardSettings.idField          = '';
          if (searchEngine === 'es' || searchEngine === 'os') {
            $scope.pendingWizardSettings.idField        = '_id';
          }
          $scope.pendingWizardSettings.titleField       = '';
          $scope.pendingWizardSettings.additionalFields = '';
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
