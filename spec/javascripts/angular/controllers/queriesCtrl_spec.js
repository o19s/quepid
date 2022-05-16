'use strict';

describe('Controller: QueriesCtrl', function () {

  // load the controller's module
  beforeEach(module('QuepidTest'));

  let QueriesCtrl,
    scope;

  const starWarsQuery = {queryId: 1, queryText: 'star wars'};
  const starTrekQuery = {queryId: 2, queryText: 'star trek'};
  const starManQuery = {queryId: 3, queryText: 'STARMAN'};
  const boxingQuery = {queryId: 4, queryText: 'The Boxing Match'};

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    QueriesCtrl = $controller('QueriesCtrl', {
      $scope: scope
    });
  }));


  it('no query filter defined matches everything', function () {
    expect(scope.matchQueryFilter(starWarsQuery)).toBe(true);
  });

  it('use query filter to match queries', function () {

    scope.queryFilter = 'star';

    expect(scope.matchQueryFilter(starWarsQuery)).toBe(true);
    expect(scope.matchQueryFilter(starTrekQuery)).toBe(true);

    scope.queryFilter = 'boxing';
    expect(scope.matchQueryFilter(starTrekQuery)).toBe(false);
  });

  it('use query filter to match mixed case queries and filter', function () {

    scope.queryFilter = 'Star';

    expect(scope.matchQueryFilter(starWarsQuery)).toBe(true);
    expect(scope.matchQueryFilter(starTrekQuery)).toBe(true);
    expect(scope.matchQueryFilter(starManQuery)).toBe(true);
    expect(scope.matchQueryFilter(boxingQuery)).toBe(false);

  });

  it('use query filter to match mixed case queries', function () {

    scope.queryFilter = 'war';

    expect(scope.matchQueryFilter(starWarsQuery)).toBe(true);
    expect(scope.matchQueryFilter(starTrekQuery)).toBe(false);

  });

});
