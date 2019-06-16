'use strict';

describe('Service: varExtractorSvc', function () {

  // load the service's module
  beforeEach(module('QuepidTest'));

  // instantiate service
  var varExtractorSvc;
  beforeEach(inject(function (_varExtractorSvc_) {
    varExtractorSvc = _varExtractorSvc_;
  }));

  it('extracts curator var names from all the mess', function () {
    var string = 'phrase=jobTitle:("#$keyword1## #$keyword2##" OR "#$keyword2## #$keyword3##")&keywords={!edismax qf="jobTitle^10 jobDesc" tie=1.0}#$query##&phraseScore=div(product(sum(##k##,1),query($phrase)),product(query($phrase),##k##))&phraseFunc=if(query($phrase),1.5,1)&q=_val_:"product($phraseFunc,1)"&fq={!edismax qf="jobTitle jobDesc"}#$query##';

    var names = varExtractorSvc.extract(string);
    expect(names.length).toBe(2);
    expect(names[0]).toEqual('k');
  });

});
