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



        //userSvc.triggerWizard = triggerWizard;
        userSvc.getCurrentUser()
          .then(function() {
            var user = userSvc.getUser();
            console.log("not sure why, but setting userSvc.triggerWizard to " + triggerWizard);
            console.log("I think the bootstrap service ought to decide this");
            console.log("Here is caseNo:" + caseNo);
            console.log(user);

            // If a user isn't part of a team, (i.e they just signed up for Quepid, they weren't invited), then
            // if they haven't done the create case wizard, we should pop it open.  firstLogin == true.
            //if (user.firstLogin && !user.belongsToTeam){
            //  userSvc.triggerWizard = true;
            //}



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
