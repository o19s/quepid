'use strict';

describe('Controller: BrowseQueryModalInstanceCtrl', function () {
  beforeEach(module('QuepidTest'));

  it('encodes spaces in browse URL query parameters for curl', inject(function ($controller) {
    var query = {
      browseUrl: function () {
        return 'http://solr.example.test/select?q=work&fl=id catch_line structure text';
      }
    };
    var clipboardSvc = { copy: jasmine.createSpy('copy') };
    var curlGenerator = spyOn(window, 'CurlGenerator').and.returnValue('curl command');

    $controller('BrowseQueryModalInstanceCtrl', {
      $quepidModalInstance: { dismiss: jasmine.createSpy('dismiss') },
      clipboardSvc: clipboardSvc,
      query: query,
      selectedTry: {},
      engineName: 'Solr'
    });

    expect(curlGenerator).toHaveBeenCalledWith(jasmine.objectContaining({
      url: "'http://solr.example.test/select?q=work&fl=id+catch_line+structure+text'"
    }));
  }));
});
