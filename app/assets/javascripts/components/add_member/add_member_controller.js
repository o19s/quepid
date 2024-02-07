'use strict';

/*jshint latedef:false */

angular.module('QuepidApp')
  .controller('AddMemberCtrl', [
    '$scope',
    'flash',
    'teamSvc', 'userSvc',
    function(
      $scope,
      flash,
      teamSvc, userSvc
    ) {
      var ctrl = this;

      $scope.$watch('team', function() {
        ctrl.team = $scope.team;
      });

      // Functions
      ctrl.addMember = addMember;
      ctrl.getUsers = getUsers;
      ctrl.selectMember = selectMember;
      ctrl.testIsEmailAddress = testIsEmailAddress;
      ctrl.inviteUserToJoin = inviteUserToJoin;

      function selectMember($item) {
        ctrl.selectedMember = $item;
      }

      function addMember() {
        if (angular.isDefined(ctrl.selectedMember)) {
          teamSvc.addMember(ctrl.team, ctrl.selectedMember)
            .then(function() {
              flash.success = 'New member added';
              ctrl.selected = '';
            }, function(response) {
              flash.error = response.data.error;
            });
        } else {
          teamSvc.addMemberByEmail(ctrl.team, ctrl.selected)
            .then(function() {
              flash.success = 'New member added';
              ctrl.selected = '';
            }, function(response) {
              flash.error = response.data.error;
            });
        }
      }

      function getUsers(prefix) {
        return userSvc.users(prefix)
          .then(function(response) {
            return response.data.users;
          });
      }

      function inviteUserToJoin() {
        teamSvc.inviteUserToJoin(ctrl.team, ctrl.selected)
          .then(function(message) {
            flash.success = message;
            ctrl.selected = '';
          }, function(response) {
            flash.error = response.data.error;
          });

      }

      function testIsEmailAddress(val) {
        const emailVer = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        if (emailVer.test(val)) {
          return true;
        }
        else {
          return false;
        }
      }
    }
  ]);
