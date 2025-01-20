'use strict';
/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('SettingsCtrl', [
    '$scope','$location',
    'flash',
    'settingsSvc',
    function (
      $scope, $location,
      flash,
      settingsSvc
    ) {
      $scope.settingsModel = {};
      $scope.pendingSettings = {
        searchEngine: '',
        searchUrl:    '',
        titleField:   '',
        searchEndpointId: ''
      };

      $scope.settingsModel.settingsId = function() {
        return settingsSvc.settingsId();
      };

      var reset = function() {
        var currSettings = settingsSvc.editableSettings();

        this.searchEndpointId         = currSettings.searchEndpointId;
        this.endpointName             = currSettings.endpointName;
        this.searchEngine             = currSettings.searchEngine;
        this.searchEndpointId         = currSettings.searchEndpoint;
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
         // As updates to our settings are successfully submitted, the settingsId() is incremented, which
         // triggers this, and then we update the pendingSettings for the UI.
         // Reinit our pending settings from the service
         $scope.pendingSettings = settingsSvc.editableSettings();
         $scope.pendingSettings.reset = reset;

         // pass pending settings onward to be saved
         $scope.pendingSettings.submit = submit;
      });

      function submit () {
        let validateJson = false;
        if ( $scope.pendingSettings.searchEngine === 'es'  || $scope.pendingSettings.searchEngine === 'os' ||  $scope.pendingSettings.searchEngine === 'vectara' || $scope.pendingSettings.searchEngine === 'algolia'){
          validateJson = true;
        }
        else if ($scope.pendingSettings.searchEngine === 'searchapi'){
          validateJson = $scope.pendingSettings.selectedTry.queryParams.indexOf('{') === 0;
        }
        if ( validateJson) {
          // Verify that JSON is valid
          try {
            var jsonObject = JSON.parse($scope.pendingSettings.selectedTry.queryParams);
            $scope.pendingSettings.selectedTry.queryParams = JSON.stringify(jsonObject, null, 2);

          } catch (e) {
            flash.error = 'Please provide a valid formatted JSON object for the query DSL.';
            return;
          }
        }

        settingsSvc.save($scope.pendingSettings);
      }
    }
  ]);
