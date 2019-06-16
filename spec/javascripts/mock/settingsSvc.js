'use strict';

(function (wind) {
  var mockFieldSpec = null;
  var mockSolrUrl = 'http://example.com:1234/collection1/select';
  var mockTry = {
    args: {
      q: ['#$query##'],
    },
    tryNo: 2
  };

  var mockSettings = {selectedTry: mockTry,
                      createFieldSpec: function() {
                        return mockFieldSpec;
                      },
                      searchUrl: mockSolrUrl};
  var MockSettingsSvc = function() {
    this.editableSettings = function() {
      return mockSettings;
    };
    this.setMockFieldSpec = function(fieldSpec) {
      mockFieldSpec = fieldSpec;
    };
  };
  wind.MockSettingsSvc = MockSettingsSvc;
})(window);
