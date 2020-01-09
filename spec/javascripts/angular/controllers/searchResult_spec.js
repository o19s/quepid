'use strict';

describe('Controller: SearchResultCtrl', function () {

  // load the controller's module
  beforeEach(module('QuepidTest'));

  var SearchResultCtrl,
    scope;

  // Initialize the controller and a mock scope

  //beforeEach(inject(function ($controller, $rootScope) {
  //  scope = $rootScope.$new();
  //  SearchResultCtrl = $controller('SearchResultCtrl', {
  //    $scope: scope
  //  });
  //}));

  it('properly detects a field with leading http or www text', function() {

    // This method should actually be on the SearchResultCtrl (searchResult.js), however
    // we don't know how to make this test work.  So leaving this way for now.

    var isUrl = function(value) {
      return (/^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/gm.test(value));
    };

    expect(isUrl("http://www.example.com")).toBe(true);
    expect(isUrl("https://www.example.com/blah")).toBe(true);
    expect(isUrl("some text with nested https://www.example.com/blah shouldnt be true")).toBe(false);
    expect(isUrl("  https://www.example.com/blah")).toBe(false);
    expect(isUrl("  https://www.example.com/blah")).toBe(false);
    expect(isUrl("www.example.com/blah")).toBe(true);
    expect(isUrl("https://image.tmdb.org/t/p/w185/6mtUJKyedvQwEKXfWzJt3vtWx1M.jpg"))

  });

  it('properly detects if we have a JSON object', function() {

    // This method should actually be on the SearchResultCtrl (searchResult.js), however
    // we don't know how to make this test work.  So leaving this way for now.

    var isJSONObject = function(value) {
      //return typeof value === 'object' &&  value instanceof Array !== true;
      if (typeof value === 'object' && value instanceof Array === true) {
        return typeof value[0] === 'object'
      }
      else if (typeof value === 'object' &&  value instanceof Array !== true) {
        return true;
      }
      return false;
    };


    var json_obj = { name: "Drama", id: 18};
    var string_array = [ "some array" ];
    var json_array = [ { name: "Drama", id: 18}, { name: "Horror", id: 3} ]

    expect(isJSONObject("hello world")).toBe(false);
    expect(isJSONObject(json_obj)).toBe(true);
    expect(isJSONObject(string_array)).toBe(false);
    expect(isJSONObject(json_array)).toBe(true);
  });

});
