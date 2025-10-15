'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ImportCaseModalInstanceCtrl', [
    '$uibModalInstance',
    'caseSvc',
    function (
      $uibModalInstance,
      caseSvc
    ) {
      var ctrl = this;

      ctrl.import = { loading: false };
  
      ctrl.ok = function () {
        var file = document.getElementById('caseJson').files[0];
        var reader = new FileReader();
        ctrl.import.loading = true;
        reader.onload = function(e) {
          var contents = e.target.result;
          var jsonData = JSON.parse(contents);
         
          caseSvc.importCase(jsonData)
            .then(function(response) {
              // Handle success
              console.log('File uploaded successfully');
              ctrl.import.loading = false;
              let modalResponse = {
                success: true,
                message: 'Successfully imported Case.'
              };
              if (response.archived){
                modalResponse.message += ' Note that this Case is Archived and you will need to unarchive it in order to use it.';
              }
              $uibModalInstance.close(modalResponse);
            })
            .catch(function(response) {
              // Handle error
              console.error('Error uploading file:', response);
              let errorMessage = 'Unable to import Case: ';
              errorMessage += response.status;
              errorMessage += ' - ' + response.statusText;
              // Convert JSON to nice error messages
              const errorMessages = Object.entries(response.data).map(([field, errors]) => {
                const formattedField = field.charAt(0).toUpperCase() + field.slice(1);
                const formattedErrors = errors.join(', ');
                return `${formattedField}: ${formattedErrors}`;
              });
              
              // Create a single error message
              errorMessage += ': ' + errorMessages.join('<br/>');

              let modalResponse = {
                error: true,
                message: errorMessage.toString()
              };
              ctrl.import.loading = false;
              $uibModalInstance.close(modalResponse);
            });
        };
    
        reader.readAsText(file);

      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
