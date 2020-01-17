'use strict';

 /*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('WizardModalCtrl', [
    '$rootScope', '$scope', '$uibModalInstance', '$log', '$window', '$q',
    'WizardHandler',
    'settingsSvc', 'SettingsValidatorFactory',
    'docCacheSvc', 'queriesSvc', 'caseTryNavSvc', 'caseSvc', 'userSvc',
    function (
      $rootScope, $scope, $uibModalInstance, $log, $window, $q,
      WizardHandler,
      settingsSvc, SettingsValidatorFactory,
      docCacheSvc, queriesSvc, caseTryNavSvc, caseSvc, userSvc
    ) {
      $log.debug('Init Wizard settings ctrl');
      $scope.wizardSettingsModel = {};

      $scope.pendingWizardSettings = angular.copy(settingsSvc.defaults.solr);

      $scope.wizardSettingsModel.settingsId = function() {
        return settingsSvc.settingsId();
      };

      $scope.udpateSettingsDefaults = function() {
        var settings = settingsSvc.defaults[$scope.pendingWizardSettings.searchEngine];
        $scope.pendingWizardSettings.additionalFields         = settings.additional;
        $scope.pendingWizardSettings.fieldSpec                = settings.fieldSpec;
        $scope.pendingWizardSettings.idField                  = settings.idField;
        $scope.pendingWizardSettings.searchEngine             = settings.searchEngine;
        $scope.pendingWizardSettings.searchUrl                = settings.searchUrl;
        $scope.pendingWizardSettings.selectedTry.queryParams  = settings.queryParams;
        $scope.pendingWizardSettings.titleField               = settings.titleField;
        $scope.pendingWizardSettings.urlFormat                = settings.urlFormat;
        $scope.reset();
      };

      $scope.validate     = validate;
      $scope.submit       = submit;
      $scope.reset        = reset;
      $scope.reset();
      $scope.searchFields = [];

      function reset() {
        $scope.validating = false;
        $scope.urlValid = $scope.urlInvalid = false;
      }

      function submit() {
        if ($scope.urlValid) {
          WizardHandler.wizard().next();
        }
      }

      function validate (justValidate) {
        if (angular.isUndefined(justValidate)) {
          justValidate = false;
        }
        $scope.validating = true;
        $scope.urlValid = $scope.urlInvalid = false;

        var validator = new SettingsValidatorFactory($scope.pendingWizardSettings);
        validator.validateUrl()
        .then(function () {
          $scope.validating   = false;
          $scope.urlValid     = true;
          $scope.searchFields = validator.fields;
          $scope.idFields     = validator.idFields;

          // Since the defaults are being overridden by the editableSettings(),
          // make sure the default id, title, and additional fields are set
          // if the URL is still set as the default
          var searchEngine  = $scope.pendingWizardSettings.searchEngine;
          var defaults      = settingsSvc.defaults[searchEngine];
          var defaultUrl    = defaults.searchUrl;
          var newUrl        = $scope.pendingWizardSettings.searchUrl;
          if ( newUrl === defaultUrl ) {
            $scope.pendingWizardSettings.idField          = defaults.idField;
            $scope.pendingWizardSettings.titleField       = defaults.titleField;
            $scope.pendingWizardSettings.additionalFields = defaults.additional;
          } else {
            $scope.pendingWizardSettings.idField          = '';
            if (searchEngine === 'es') {
              $scope.pendingWizardSettings.idField        = '_id';
            }
            $scope.pendingWizardSettings.titleField       = '';
            $scope.pendingWizardSettings.additionalFields = '';
          }
          if (!justValidate) {
            WizardHandler.wizard().next();
          }
        }, function () {
          $scope.urlInvalid = true;
          $scope.validating = false;
        });
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
            'thumb:'
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
        angular.merge($scope.pendingWizardSettings, settingsSvc.editableSettings());
        $scope.pendingWizardSettings.newQueries = [];

        if(userSvc.getUser().firstTime===true){
          $scope.pendingWizardSettings.caseName = 'Movies Search';
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
          settingsSvc.save($scope.pendingWizardSettings)
          .then(function() {
            var latestSettings = settingsSvc.editableSettings();
            docCacheSvc.invalidate();
            docCacheSvc.update(latestSettings);
            queriesSvc.changeSettings(caseTryNavSvc.getCaseNo(), latestSettings);

            //Change Case Name (Separate from Dev settings)
            if(typeof($scope.pendingWizardSettings.caseName)!=='undefined'&&$scope.pendingWizardSettings.caseName!==''){
              caseSvc.getSelectedCase().rename($scope.pendingWizardSettings.caseName);
            }
            var length = $scope.pendingWizardSettings.newQueries.length;
            var query = null;

            var updateUserNumQueries = function() {
              $rootScope.currentUser.queryAdded();
            };

            var queryPromise = function(q) {
              return queriesSvc.persistQuery(q)
                      .then(updateUserNumQueries());
            };

            var createPromises = [];

            for(var queryIndex = 0; queryIndex < length; queryIndex++){
              query = $scope.pendingWizardSettings.newQueries[queryIndex];

              if( typeof(query.queryString) !== 'undefined' && query.queryString !== '' ) {
                var q = queriesSvc.createQuery(query.queryString);

                createPromises.push(
                  queryPromise(q)
                    .then(q.search)
                );
              }
            }

            $q.all(createPromises);

            $uibModalInstance.close();
          });
        };
      });

      $scope.close = function() {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
