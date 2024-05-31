'use strict';

angular.module('QuepidApp')
  .controller('DetailedDocCtrl', [
    '$scope', '$uibModalInstance',
    'settingsSvc','caseTryNavSvc',
    'doc',
    function DetailedDocCtrl(
      $scope, $uibModalInstance,
      settingsSvc, caseTryNavSvc,
      doc) {
      
      $scope.doc = doc;
      
      $scope.linkToDoc = function() {
        let url = $scope.doc._url();
        let credentials = settingsSvc.applicableSettings().basicAuthCredential;
        
        if (credentials){                    
          url = url.replace('://', `://${credentials}@`);
        }
        
        if (settingsSvc.applicableSettings().proxyRequests  === true) {
          url = caseTryNavSvc.getQuepidProxyUrl() + url;
        }
                
        return url;
      };
      
      $scope.showAllFields = false;

      $scope.allFields = function() {
        return JSON.stringify($scope.doc.doc.origin(),null,2);
      };
      
      $scope.allFieldsFormatted = $scope.allFields();
      


      $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
