'use strict';

/*jslint latedef:false*/

angular.module('UtilitiesModule')
  .service('bootstrapSvc', [
    '$http',
    '$location',
    '$rootScope',
    'userSvc', 'caseSvc', 'caseTryNavSvc',
    function bootstrapSvc($http, $location, $rootScope, userSvc, caseSvc, caseTryNavSvc) {
      var self = this;

      // Public Functions
      self.run = run;

      function run(triggerWizard, caseNo, tryNo) {
        // Fetch the current user who is logged in
        userSvc.triggerWizard = triggerWizard;
        userSvc.getCurrentUser()
          .then(function() {
            var user = userSvc.getUser();

            // Assign it so all controllers have access to the current user
            // instead of having to call the userSvc.getUser() function all the time.
            $rootScope.currentUser = user;

            if (user && angular.isDefined(caseNo) && angular.isDefined(tryNo)) {
              caseTryNavSvc.pathRequested({caseNo: caseNo, tryNo: tryNo});
            }
          });
      }
    }
  ]);
