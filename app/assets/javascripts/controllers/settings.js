'use strict';
/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('SettingsCtrl', [
    '$scope','$location',
    'flash',
    'settingsSvc','searchEndpointSvc',
    function (
      $scope, $location, 
      flash, 
      settingsSvc, searchEndpointSvc
    ) {
      $scope.settingsModel = {};
      $scope.pendingSettings = {
        searchEngine: '',
        searchUrl:    '',
        titleField:   '',
        searchEndpointId: ''
      };
      
      //searchEndpointSvc.list()
      // .then(function() {
      //   $scope.searchEndpoints = searchEndpointSvc.searchEndpoints;        
      // });      
            
      $scope.settingsModel.settingsId = function() {
        //console.log('$scope.settingsModel.settingsId returning settingsid');
        return settingsSvc.settingsId();
      };

      var reset = function() {
        var currSettings = settingsSvc.editableSettings();
        if ( this.searchEndpointId !== currSettings.searchEndpointId) {
          //var searchEndpointToUse = $scope.searchEndpoints.find(obj => obj.id === $scope.settings.searchEndpointId);
          //currSettings = settingsSvc.pickSettingsToUse($scope.pendingSettings.searchEngine, null);
          //currSettings.fieldSpec = currSettings.fieldSpec + ', ' + currSettings.additionalFields.join(', ');
          //$scope.pendingSettings.urlFormat = currSettings.urlFormat;
        }
        this.searchEndpointId         = currSettings.searchEndpointId;
        this.endpointName             = currSettings.endpointName;
        this.searchEngine             = currSettings.searchEngine;
        this.searchEndpointId         = currSettings.searchEndpoint;
        //this.apiMethod                = currSettings.apiMethod;



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

         //if ( angular.isDefined($scope.pendingSettings.searchEngine) && $scope.pendingSettings.searchEngine !== null ) {
         //  var settingsToUse = settingsSvc.pickSettingsToUse($scope.pendingSettings.searchEngine, $scope.pendingSettings.searchUrl);
          // $scope.pendingSettings.urlFormat = settingsToUse.urlFormat;
          
           // pass pending settings onward to be saved
           $scope.pendingSettings.submit = submit;
          //}


      });

      function submit () {
        if ( $scope.pendingSettings.searchEngine === 'es'  || $scope.pendingSettings.searchEngine === 'os' ||
             $scope.pendingSettings.searchEngine === 'vectara') {
          // Verify that JSON is valid
          try {
            var jsonObject = JSON.parse($scope.pendingSettings.selectedTry.queryParams);
            $scope.pendingSettings.selectedTry.queryParams = angular.toJson(jsonObject, true);
          } catch (e) {
            flash.error = 'Please provide a valid JSON object for the query DSL.';
            return;
          }

          // With the Seach Endpoint Refactor, this is done in case wizard or in server side code.
          // Verify that custom headers are valid if set
          //try {
          //  if ($scope.pendingSettings.customHeaders.length > 0) {
          //    JSON.parse($scope.pendingSettings.customHeaders);
          //  }
          //} catch (e) {
          //  flash.error = 'Please provide a valid JSON object for the custom headers.';
          //  return;
          //}

        }

        settingsSvc.save($scope.pendingSettings);
      }
    }
  ]);
