'use strict';
/*jshint camelcase: false */

angular.module('QuepidApp')
  // AngularJS will instantiate a singleton by calling "new" on this function
  .service('teamSvc', [
    '$http',
    'broadcastSvc',
    function teamSvc($http, broadcastSvc) {
      this.teams = [];

      var Team = function(id, name, ownerId, owner, cases, cases_count, members_count, members, scorers, owned, books, search_endpoints) {
        this.id           = id;
        this.name         = name;
        this.ownerId      = ownerId;
        this.owner        = owner;
        this.cases        = cases;
        this.casesCount   = cases_count;
        this.membersCount = members_count;
        this.members      = members;
        this.scorers      = scorers;
        this.owned        = owned;
        this.books        = books;
        this.searchEndpoints  = search_endpoints;  // camel case mapping


        angular.forEach(this.cases, function(c) {
          // This is really ugly.  We don't use our standard CaseSvc mapping, and probably should!
          c.caseNo = c.case_id;
          delete c.case_id;
          c.lastScore = c.last_score;
          delete c.last_score;
          c.caseName = c.case_name;
          delete c.case_name;
          c.ownerName = c.owner_name;
          delete c.owner_name;
          c.ownerId = c.owner_id;
          delete c.owner_id;
          c.lastTry  = c.last_try_number;
          delete c.last_try_number;
          c.bookName = c.book_name;
          delete c.book_name;
          c.bookId = c.book_id;
          delete c.book_id;
          c.queriesCount = c.queries_count;
          delete c.queries_count;
        });

        angular.forEach(this.scorers, function(s) {
          // This is really ugly.  We don't use our standard ScorerFactory mapping, and probably should!
          s.scorerId = s.scorer_id;
          delete s.scorer_id;
          s.ownerName = s.owner_name;
          delete s.owner_name;
          s.ownerId = s.owner_id;
          delete s.owner_id; 
          s.scaleWithLabels = s.scale_with_labels;
          delete s.scale_with_labels;    
        });

        angular.forEach(this.books, function(b) {
          // This is really ugly.  We don't use our standard book mapping, and probably should!
          b.selectionStrategy = b.selection_strategy;
          delete b.selection_strategy;
        });
        
        angular.forEach(this.searchEndpoints, function(b) {
          // This is really ugly.  We don't use our standard book mapping, and probably should!
          b.id = b.search_endpoint_id;
          delete b.search_endpoint_id;
          b.apiMethod = b.api_method;
          delete b.api_method;
          b.customHeaders = b.custom_headers;
          delete b.custom_headers;
          b.endpointUrl = b.endpoint_url;
          delete b.endpoint_url;
          b.searchEngine = b.search_engine;
          delete b.search_engine;     
          b.ownerId = b.owner_id;
          delete b.owner_id;     
        });


      };

      this.constructFromData = function(data) {
        return new Team(
          data.id,
          data.name,
          data.owner_id,
          data.owner,
          data.cases,
          data.cases_count,
          data.members_count,
          data.members,
          data.scorers,
          data.owned,
          data.books,
          data.search_endpoints
        );
      };

      var contains = function(list, team) {
        return list.filter(function(item) { return item.id === team.id; }).length > 0;
      };

      var hasMember = function(team, member) {
        return team.members.filter(function(item) { return item.id === member.id; }).length > 0;
      };

      this.create = function(name) {
        // http POST /api/teams
        var url   = 'api/teams';
        var data  = { 'name': name };
        var self  = this;

        return $http.post(url, data)
          .then(function(response) {
            var team = self.constructFromData(response.data);

            self.teams.push(team);

            return team;
          });
      };

      this.edit = function(team) {
        // http PUT /teams/<int:teamId>
        var url   = 'api/teams/' + team.id;
        var data  = { 'name': team.name };
        var self  = this;

        return $http.put(url, data)
          .then(function(response) {
            var team = self.constructFromData(response.data);

            return team;
          });
      };

      this.changeOwner = function(team, newOwnerId) {
        // http PUT /teams/<int:teamId>/owners/<int:id>
        var url   = 'api/teams/' + team.id + '/owners/' + newOwnerId;
        var data  = {};
        var self  = this;

        return $http.put(url, data)
          .then(function(response) {
            var team = self.constructFromData(response.data);

            broadcastSvc.send('teamUpdated', team);

            return team;
          });
      };

      this.delete = function(team) {
        // http DELETE /api/teams/<int:teamId>
        var url   = 'api/teams/' + team.id;
        var self  = this;

        return $http.delete(url)
          .then(function() {
            self.teams.splice(self.teams.indexOf(team), 1);
          });
      };

      this.get = function(id) {
        // http GET api/teams/<int:teamId>
        var url   = 'api/teams/' + id;
        var self  = this;

        return $http.get(url)
          .then(function(response) {
            var team = self.constructFromData(response.data);

            return team;
          });
      };
      
      this.list = function() {
        var url   = 'api/teams';
        var self  = this;

        // Clear the list just in case the data on the server changed,
        // we want to have the latest list.
        // TODO: write tests for this.
        self.teams = [];

        return $http.get(url)
          .then(function(response) {
            angular.forEach(response.data.teams, function(dataTeam) {
              var team = self.constructFromData(dataTeam);

              if(!contains(self.teams, team)) {
                self.teams.push(team);
              }
            });
          });
      };

      this.addMember = function(team, member) {
        // http POST /api/teams/<int:teamId>/members
        var url   = 'api/teams/' + team.id + '/members';
        var data  = { id:  member.id };

        if ( team.members === undefined ) {
          team.members = [];
        }

        return $http.post(url, data)
          .then(function() {
            if ( !hasMember(team, member) ) {
              team.members.push(member);
            }
          });
      };

      this.addMemberByEmail = function(team, email) {
        // http POST /api/teams/<int:teamId>/members
        var url   = 'api/teams/' + team.id + '/members';
        var data  = { id:  email };

        if ( team.members === undefined ) {
          team.members = [];
        }

        return $http.post(url, data)
          .then(function(response) {
            var member = response.data;

            if ( !hasMember(team, member) ) {
              team.members.push(member);
            }
          });
      };

      this.inviteUserToJoin = function(team, email) {
        // http POST /api/teams/<int:teamId>/members/invite
        var url   = 'api/teams/' + team.id + '/members/invite';
        var data  = { id:  email };

        if ( team.members === undefined ) {
          team.members = [];
        }

        return $http.post(url, data)
          .then(function(response) {
            var member = response.data;

            if ( !hasMember(team, member) ) {
              team.members.push(member);
            }
            
            return response.data.message;
          });
      };

      this.removeMember = function(team, member) {
        // http DELETE /api/teams/<int:teamId>/members/<int:memberId>
        var url   = 'api/teams/' + team.id + '/members/' + member.id;

        if ( team.members === undefined ) {
          team.members = [];
        }

        return $http.delete(url)
          .then(function() {
            team.members.splice(team.members.indexOf(member), 1);
          });
      };

      this.shareCase = function(team, caseNo) {
        // http POST /api/teams/<int:teamId>/cases
        var url   = 'api/teams/' + team.id + '/cases';
        var data  = { id: caseNo };

        return $http.post(url, data)
          .then(function(response) {
            team.cases.push(response.data);

            broadcastSvc.send('caseTeamAdded', {
              caseNo: caseNo,
              team:   team,
            });
          });
      };

      this.unshareCase = function(team, caseNo) {
        // http DELETE /api/teams/<int:teamId>/cases/<int:caseId>
        var url   = 'api/teams/' + team.id + '/cases/' + caseNo;
        var data  = { id: caseNo };

        return $http.delete(url, data)
          .then(function() {

          });
      };

      this.shareScorer = function(team, scorerId) {
        // http POST /api/teams/<int:teamId>/scorers
        var url   = 'api/teams/' + team.id + '/scorers';
        var data  = { id: scorerId };

        return $http.post(url, data)
          .then(function(response) {
            team.scorers.push(response.data);
          });
      };

      this.removeScorer = function(team, scorer) {
        // http DELETE /api/teams/<int:teamId>/scorers/<int:scorerId>
        var url   = 'api/teams/' + team.id + '/scorers/' + scorer.scorerId;

        if ( team.scorers === undefined ) {
          team.scorers = [];
        }

        return $http.delete(url)
          .then(function() {
            team.scorers.splice(team.scorers.indexOf(scorer), 1);
          });
      };
    }
  ]);
