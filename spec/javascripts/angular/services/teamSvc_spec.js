'use strict';

describe('Service: teamSvc', function () {

  // load the service's module
  beforeEach(module('QuepidTest'));

  var mockTeams = {
    'teams': [
      {
        'id':       1,
        'name':     'Team 1',
        'owner_id': 1,
        'owned':    true,
        'members':  [],
        'cases':    [],
        'scorers':  []
      },
      {
        'id':       2,
        'name':     'Team 2',
        'owner_id': 1,
        'owned':    true,
        'members':  [],
        'cases':    [],
        'scorers':  []
      },
      {
        'id':       3,
        'name':     'Team 3',
        'owner_id': 2,
        'owned':    false,
        'members':  [],
        'cases':    [],
        'scorers':  []
      }
    ]
  };

  var mockTeamData = {
    id:       1,
    name:     'Team 1',
    owner_id: 1,
    members:  [],
    cases:    [],
    scorers:  [],
  };
  var mockTeam;

  var mockMember = {
    'id':       1,
    'name':     'member',
  };

  var mockInvitee = {
    'email':     'newuser@example.com',
  };

  var mockCase = {
    'caseNo':           1,
    'lastTry':          0,
    'case_name':         'Case'
  };

  var mockScorer = {
    'scorerId': 1,
    'name':     'Scorer Test',
    'code':     'pass()'
  };

  var $httpBackend = null;

  // instantiate service
  var teamSvc;
  beforeEach(function() {
    inject(function (_teamSvc_, $injector) {
      teamSvc = _teamSvc_;
      $httpBackend = $injector.get('$httpBackend');

      mockTeam = teamSvc.constructFromData(mockTeamData);
    });
  });

  it('gets a list of team', function() {
    var url = '/api/teams';
    $httpBackend.expectGET(url).respond(200, mockTeams);
    teamSvc.list().
      then(function() {
        expect(teamSvc.teams.length).toBe(3);
      });
    $httpBackend.flush();
  });

  it('creates an team', function() {
    var url = '/api/teams';
    $httpBackend.expectPOST(url).respond(201, mockTeamData);

    teamSvc.create(mockTeam.name).
      then(function(response) {
        expect(teamSvc.teams.length).toBe(1);
        expect(response).toEqual(mockTeam);
      });
    $httpBackend.flush();
  });

  it('edits an team', function() {
    var url = '/api/teams/' + mockTeam.id;
    $httpBackend.expectPUT(url).respond(200, mockTeamData);

    teamSvc.edit(mockTeam)
      .then(function(response) {
        expect(response).toEqual(mockTeam);
      });
    $httpBackend.flush();
  });

  it('fetches an team', function() {
    var url = '/api/teams/' + mockTeam.id;
    $httpBackend.expectGET(url).respond(200, mockTeamData);

    teamSvc.get(mockTeam.id)
      .then(function(response) {
        expect(response).toEqual(mockTeam);
      });
    $httpBackend.flush();
  });

  it('fetches an team with its cases', function() {
    var url = '/api/teams/' + mockTeam.id + '?load_cases=true';

    var mockTeamWithCasesResponse = {
        id:       1,
        name:     'Team 1',
        owner_id: 1,
        members:  [],
        cases:    [
          {
          'caseNo':           1,
          'lastTry':          0,
          'case_name':         'Case'
          }
        ],
        scorers:  [],
      }

    $httpBackend.expectGET(url).respond(200, mockTeamWithCasesResponse);

    var load_cases = true;

    teamSvc.get(mockTeam.id, load_cases)
      .then(function(response) {
        expect(response.cases[0].caseName).toBe('Case');
    });
    //var team = teamSvc.get(mockTeam.id, load_cases);
    $httpBackend.flush();
    //$httpBackend.verifyNoOutstandingExpectation();
    //console.log("Lets see what we go");
    //console.log(team);
    //expect(team.cases[0].caseName).toBe('Case');

  });

  it('adds a member to the team', function() {
    var url   = '/api/teams/' + mockTeam.id + '/members';
    var data  = { id:  mockMember.id };
    var mockResponse = mockTeam;

    $httpBackend.expectPOST(url, data).respond(200);

    teamSvc.addMember(mockTeam, mockMember).
      then(function(response) {
        expect(mockTeam.members.length).toBe(1);
      });
    $httpBackend.flush();
  });

  it('removes a member from the team', function() {
    var url   = '/api/teams/' + mockTeam.id + '/members/' + mockMember.id;

    $httpBackend.expectDELETE(url).respond(200);

    teamSvc.removeMember(mockTeam, mockMember);
    $httpBackend.flush();
  });

  it('invites a user to join the team', function() {
    var url   = '/api/teams/' + mockTeam.id + '/members/invite';
    var data  = {
      id: mockInvitee.email,
    };
    var mockResponse = mockTeam;

    $httpBackend.expectPOST(url, data).respond(200);

    teamSvc.inviteUserToJoin(mockTeam, mockInvitee.email).
      then(function(response) {
        expect(mockTeam.members.length).toBe(1);
      });
    $httpBackend.flush();
  });

  it('adds a case to the team', function() {
    var url   = '/api/teams/' + mockTeam.id + '/cases';
    var data  = { id: mockCase.caseNo };
    var mockResponse = mockTeam;

    $httpBackend.expectPOST(url, data).respond(200, mockCase);

    teamSvc.shareCase(mockTeam, mockCase.caseNo).
      then(function(response) {
        expect(mockTeam.cases.length).toBe(1);
      });
    $httpBackend.flush();
  });

  it('adds a scorer to the team', function() {
    var url = '/api/teams/' + mockTeam.id + '/scorers';
    var data  = { id: mockScorer.scorerId };
    var mockResponse = mockTeam;

    $httpBackend.expectPOST(url, data).respond(200, mockScorer);

    teamSvc.shareScorer(mockTeam, mockScorer.scorerId).
      then(function(response) {
        expect(mockTeam.scorers.length).toBe(1);
      });
    $httpBackend.flush();
  });

  it('removes a scorer from the team', function() {
    var url   = '/api/teams/' + mockTeam.id + '/scorers/' + mockScorer.scorerId;

    $httpBackend.expectDELETE(url).respond(200);

    teamSvc.removeScorer(mockTeam, mockScorer);
    $httpBackend.flush();
  });
});
