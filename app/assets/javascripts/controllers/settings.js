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
          currSettings = settingsSvc.defaults[$scope.pendingSettings.searchEngine];
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
          $scope.pendingSettings.urlFormat = settingsSvc.defaults[$scope.pendingSettings.searchEngine].urlFormat;
        }

        // pass pending settings onto be saved
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
        }

        settingsSvc.save($scope.pendingSettings);
      }
    }
  ]);
