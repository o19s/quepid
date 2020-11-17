'use strict';

describe('Service: caseCSVSvc', function () {

  // load the service's module
  beforeEach(module('QuepidTest'));

  var caseCSVSvc;

  beforeEach(function() {
    inject(function (_caseCSVSvc_) {
      caseCSVSvc = _caseCSVSvc_;
    });
  });

  describe('stringify', function () {
    var mockScores = {
      "all_rated": false,
      "case_id": 8,
      "created_at": "2015-07-14 16:08:55",
      "updated_at": "2015-07-14 16:08:55",
      "queries": {
        "1": {
          "score": 30,
          "text": "dog",
        },
        "2": {
          "score": 0,
          "text": "cat",
        },
        "3": {
          "score": '',
          "text": "foo",
        }
      },
      "score":      54.5,
      "try_id":     1,
      "user_id":    2,
      "email":      "ychaker@example.com"
    };
    var mockCase = {
      "caseName":   'Test Case',
      "teamName":   'Test Team',
      "lastScore":  mockScores,
      "teamNames":  function() { return 'Test Team'; },
    };
    var mockQueries =[
      {
        "queryId":1,
        "query_text": "dog",
        "notes": "This dog looks like a great dog."
      },
      {
        "queryId":2,
        "query_text": "cat",
        "notes": 'Is this "really" a "cat"?'
      },
      {
        "queryId":3,
        "query_text": "foo",
        "notes": "chil'laxin"
      }
    ]

    mockCase.queries = mockQueries;

    it('returns a comma separated string of query scores with the header', function () {
      var result = caseCSVSvc.stringify(mockCase, true);

      var expectedResult = "Team Name,Case Name,Case ID,Query Text,Score,Date Last Scored,Count,Notes\r\nTest Team,Test Case,8,dog,30,2015-07-14 16:08:55,,This dog looks like a great dog.\r\nTest Team,Test Case,8,cat,0,2015-07-14 16:08:55,,Is this \"\"really\"\" a \"\"cat\"\"?\r\nTest Team,Test Case,8,foo,,2015-07-14 16:08:55,,chil'laxin\r\n";

      expect(result).toEqual(expectedResult);
    });

    it('returns a comma separated string of query scores without the header', function () {
      var result = caseCSVSvc.stringify(mockCase);

      var expectedResult = "Test Team,Test Case,8,dog,30,2015-07-14 16:08:55,,This dog looks like a great dog.\r\nTest Team,Test Case,8,cat,0,2015-07-14 16:08:55,,Is this \"\"really\"\" a \"\"cat\"\"?\r\nTest Team,Test Case,8,foo,,2015-07-14 16:08:55,,chil'laxin\r\n";

      expect(result).toEqual(expectedResult);
    });

    it('escapes a value with a " in it', function () {
      var newMockCase = angular.copy(mockCase);
      newMockCase.caseName = 'Test "Case"';

      var result = caseCSVSvc.stringify(newMockCase);

      var expectedResult = 'Test Team,Test ""Case"",8,dog,30,2015-07-14 16:08:55,,This dog looks like a great dog.\r\nTest Team,Test ""Case"",8,cat,0,2015-07-14 16:08:55,,Is this ""really"" a ""cat""?\r\nTest Team,Test ""Case"",8,foo,,2015-07-14 16:08:55,,chil\'laxin\r\n';

      expect(result).toEqual(expectedResult);
    });

    it('escapes a value with a \n in it', function () {
      var newMockCase = angular.copy(mockCase);
      newMockCase.caseName = 'Test \n Case';

      var result = caseCSVSvc.stringify(newMockCase);

      var expectedResult = 'Test Team,"Test \n Case",8,dog,30,2015-07-14 16:08:55,,This dog looks like a great dog.\r\nTest Team,"Test \n Case",8,cat,0,2015-07-14 16:08:55,,Is this ""really"" a ""cat""?\r\nTest Team,"Test \n Case",8,foo,,2015-07-14 16:08:55,,chil\'laxin\r\n';

      expect(result).toEqual(expectedResult);
    });

    it('escapes a value with a \r in it', function () {
      var newMockCase = angular.copy(mockCase);
      newMockCase.caseName = 'Test \r Case';

      var result = caseCSVSvc.stringify(newMockCase);

      var expectedResult = 'Test Team,"Test \r Case",8,dog,30,2015-07-14 16:08:55,,This dog looks like a great dog.\r\nTest Team,"Test \r Case",8,cat,0,2015-07-14 16:08:55,,Is this ""really"" a ""cat""?\r\nTest Team,"Test \r Case",8,foo,,2015-07-14 16:08:55,,chil\'laxin\r\n';

      expect(result).toEqual(expectedResult);
    });

    it('escapes a value with a \n\r in it', function () {
      var newMockCase = angular.copy(mockCase);
      newMockCase.caseName = 'Test \n\r Case';

      var result = caseCSVSvc.stringify(newMockCase);

      var expectedResult = 'Test Team,"Test \n\r Case",8,dog,30,2015-07-14 16:08:55,,This dog looks like a great dog.\r\nTest Team,"Test \n\r Case",8,cat,0,2015-07-14 16:08:55,,Is this ""really"" a ""cat""?\r\nTest Team,"Test \n\r Case",8,foo,,2015-07-14 16:08:55,,chil\'laxin\r\n';

      expect(result).toEqual(expectedResult);
    });

    it('escapes a value with a , in it', function () {
      var newMockCase = angular.copy(mockCase);
      newMockCase.caseName = 'Test, Case';

      var result = caseCSVSvc.stringify(newMockCase);

      var expectedResult = 'Test Team,"Test, Case",8,dog,30,2015-07-14 16:08:55,,This dog looks like a great dog.\r\nTest Team,"Test, Case",8,cat,0,2015-07-14 16:08:55,,Is this ""really"" a ""cat""?\r\nTest Team,"Test, Case",8,foo,,2015-07-14 16:08:55,,chil\'laxin\r\n';

      expect(result).toEqual(expectedResult);
    });

    it('escapes a value that starts with =', function () {
      var newMockCase = angular.copy(mockCase);
      newMockCase.caseName = '=Test Case';

      var result = caseCSVSvc.stringify(newMockCase);

      var expectedResult = 'Test Team, =Test Case,8,dog,30,2015-07-14 16:08:55,,This dog looks like a great dog.\r\nTest Team, =Test Case,8,cat,0,2015-07-14 16:08:55,,Is this ""really"" a ""cat""?\r\nTest Team, =Test Case,8,foo,,2015-07-14 16:08:55,,chil\'laxin\r\n';

      expect(result).toEqual(expectedResult);
    });

    it('escapes a value that starts with @', function () {
      var newMockCase = angular.copy(mockCase);
      newMockCase.caseName = '@Test Case';

      var result = caseCSVSvc.stringify(newMockCase);

      var expectedResult = 'Test Team, @Test Case,8,dog,30,2015-07-14 16:08:55,,This dog looks like a great dog.\r\nTest Team, @Test Case,8,cat,0,2015-07-14 16:08:55,,Is this ""really"" a ""cat""?\r\nTest Team, @Test Case,8,foo,,2015-07-14 16:08:55,,chil\'laxin\r\n';;

      expect(result).toEqual(expectedResult);
    });

    it('escapes a value that starts with +', function () {
      var newMockCase = angular.copy(mockCase);
      newMockCase.caseName = '+Test Case';

      var result = caseCSVSvc.stringify(newMockCase);

      var expectedResult = 'Test Team, +Test Case,8,dog,30,2015-07-14 16:08:55,,This dog looks like a great dog.\r\nTest Team, +Test Case,8,cat,0,2015-07-14 16:08:55,,Is this ""really"" a ""cat""?\r\nTest Team, +Test Case,8,foo,,2015-07-14 16:08:55,,chil\'laxin\r\n';;

      expect(result).toEqual(expectedResult);
    });

    it('escapes a value that starts with -', function () {
      var newMockCase = angular.copy(mockCase);
      newMockCase.caseName = '-Test Case';

      var result = caseCSVSvc.stringify(newMockCase);

      var expectedResult = 'Test Team, -Test Case,8,dog,30,2015-07-14 16:08:55,,This dog looks like a great dog.\r\nTest Team, -Test Case,8,cat,0,2015-07-14 16:08:55,,Is this ""really"" a ""cat""?\r\nTest Team, -Test Case,8,foo,,2015-07-14 16:08:55,,chil\'laxin\r\n';;

      expect(result).toEqual(expectedResult);
    });

  });
});
