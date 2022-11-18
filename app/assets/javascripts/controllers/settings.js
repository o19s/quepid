'use strict';
/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('SettingsCtrl', [
    '$scope',
    '$location',
    'flash',
    'settingsSvc',
    function ($scope, $location, flash, settingsSvc) {
      $scope.settingsModel = {};
      $scope.pendingSettings = {
        searchEngine: '',
        searchUrl:    '',
        titleField:   ''
      };

      $scope.settingsModel.settingsId = function() {
        return settingsSvc.settingsId();
      };

      var reset = function() {
        var currSettings = settingsSvc.editableSettings();
        if ( this.searchEngine !== currSettings.searchEngine) {
          currSettings = settingsSvc.pickSettingsToUse(null, $scope.pendingSettings.searchEngine);
          currSettings.fieldSpec = currSettings.fieldSpec + ', ' + currSettings.additionalFields.join(', ')
          $scope.pendingSettings.urlFormat = currSettings.urlFormat;
        }
        this.searchEngine             = currSettings.searchEngine;
        this.apiMethod                = currSettings.apiMethod;


        if (this.searchEngine === 'solr') {
          var quepidStartsWithHttps = $location.protocol() === 'https';
          if (quepidStartsWithHttps === true){
            this.searchUrl = currSettings.secureSearchUrl;
          }
          else {
            this.searchUrl = currSettings.insecureSearchUrl;
          }
        }
        else {
          this.searchUrl = currSettings.searchUrl;
        }


        this.fieldSpec                = currSettings.fieldSpec;
        this.selectedTry.queryParams  = currSettings.queryParams;
        this.urlFormat                = currSettings.urlFormat;

        this.submit = submit;
      };

      $scope.$watch('settingsModel.settingsId()', function() {
        // Reinit our pending settings from the service
        $scope.pendingSettings = settingsSvc.editableSettings();
        $scope.pendingSettings.reset = reset;

        if ( angular.isDefined($scope.pendingSettings.searchEngine) ) {
          var settingsToUse = settingsSvc.pickSettingsToUse($scope.pendingSettings.searchUrl, $scope.pendingSettings.searchEngine);
          $scope.pendingSettings.urlFormat = settingsToUse.urlFormat;
        }

        // pass pending settings onward to be saved
        $scope.pendingSettings.submit = submit;
      });

      function submit () {
        if ( $scope.pendingSettings.searchEngine === 'es'  || $scope.pendingSettings.searchEngine === 'os') {
          // Verify that JSON is valid
          try {
            var jsonObject = JSON.parse($scope.pendingSettings.selectedTry.queryParams);
            $scope.pendingSettings.selectedTry.queryParams = angular.toJson(jsonObject, true);
          } catch (e) {
            flash.error = 'Please provide a valid JSON object for the query DSL.';
            return;
          }

          // Verify that custom headers are valid if set
          try {
            if ($scope.pendingSettings.customHeaders.length > 0) {
              JSON.parse($scope.pendingSettings.customHeaders);
            }
          } catch (e) {
            flash.error = 'Please provide a valid JSON object for the custom headers.';
            return;
          }

        }

        settingsSvc.save($scope.pendingSettings);
      }
    }
  ]);
