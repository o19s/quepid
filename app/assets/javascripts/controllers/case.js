'use strict';

angular.module('QuepidApp')
  .controller('CaseCtrl', [
    '$scope', '$uibModal', '$log',
    'caseSvc', 'caseTryNavSvc', 'queryViewSvc', 'ActionCableChannel', 'ActionCableConfig',
    function (
      $scope, $uibModal, $log,
      caseSvc, caseTryNavSvc, queryViewSvc, ActionCableChannel, ActionCableConfig
    ) {
      $scope.caseModel = {};
      $scope.caseModel.cases = caseSvc.allCases;
      $scope.caseModel.dropdownCases = caseSvc.dropdownCases;
      $scope.caseModel.reorderEnabled = false;
      $scope.scores  = [];
      $scope.theCase = caseSvc.getSelectedCase();
      $scope.caseNeedsRefresh = false;

      $scope.caseName = {
        name: null,
        startRename: false,
        rename: function() {
          caseSvc.renameCase($scope.theCase, $scope.caseName.name)
          .then(function() {
            $scope.caseName.startRename = false;
          });
        },
        cancel: function() {
          $scope.caseName.startRename = false;
          $scope.caseName.name = $scope.caseModel.selectedCase().caseName;
        }
      };

      $scope.caseNameEditModeToggle = function(){
        $scope.caseName.name = $scope.caseModel.selectedCase().caseName;
        $scope.caseName.startRename = !$scope.caseName.startRename;
      };

      $scope.caseModel.newCase = function() {
        // the server will bootstrap a new case
        // and return some default values down
        caseSvc.createCase(); //Note createCase() switches to the new case
        $scope.wizard.triggerModal();
      };

      $scope.caseModel.caseEdit = function(caseNo, caseName) {
        $log.debug('Case edited!' + caseNo + ' -- '  + caseName);
      };

      $scope.$watch(function() { return caseSvc.getSelectedCase(); }, function(aCase) {
        if (aCase) {
          $scope.theCase = aCase;
          $scope.scores  = aCase.scores;

          // connect to ActionCable
          ActionCableConfig.wsUri = "wss://quepid-pr-515.herokuapp.com/cable"
          var consumer = new ActionCableChannel('RatingChannel', { case_id: $scope.theCase.caseNo });
          var callback = function(message){
            console.log('running callback');
            console.log(message);
            // wonder if we should map from snake to camel case?
            if (message.user.id !== $scope.currentUser.id) {
              $scope.caseNeedsRefresh = true;
              $scope.caseMessage = message;
              queryViewSvc.markQueryNeedsRefresh(message.query_id);
            }
          };
          consumer.subscribe(callback).then(function(){
            $scope.$on('$destroy', function(){
              consumer.unsubscribe();
            });
          });
        }
      });

      // Not currently used as the refreshCase seems to not be happy with ActionCable reconnection.
      $scope.refreshCase = function() {
        caseTryNavSvc.navigateTo({'caseNo': $scope.theCase.caseNo, 'tryNo': $scope.theCase.lastTry});
      };

      $scope.caseModel.selectedCase = function() {
        if (caseSvc.isCaseSelected()) {
          return caseSvc.getSelectedCase();
        }
        else {
          return { caseNo: -1, caseName: '' };
        }
      };

      $scope.caseModel.caseLoaded = function() {
        return $scope.caseModel.selectedCase().caseNo !== -1;
      };

      $scope.caseModel.unarchive = function() {
        if ( !$scope.currentUser.permissions.case.create ) {
          var modalInstance = $uibModal.open({
            templateUrl:  'new_case/_denied_modal.html',
            controller:   'DeniedNewCaseModalInstanceCtrl',
            controllerAs: 'ctrl'
          });

          modalInstance.result.then(
            function() { },
            function() { }
          );
        } else {
          $uibModal.open({
            templateUrl: 'views/unarchiveCaseModal.html',
            controller: 'UnarchiveCaseCtrl'
          });
        }
      };
    }
  ]);
