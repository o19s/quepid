// Karma configuration
// Generated on Fri Nov 06 2015 19:55:18 GMT+0000 (UTC)

// Puppeteer >=25 made executablePath() return a Promise. Karma calls the
// exported config function asynchronously, so resolve the path before
// config.set() runs.
module.exports = async function(config) {
  process.env.CHROME_BIN = await require('puppeteer').executablePath()
  config.set({

    // Use project root as base (config is in spec/karma/config/)
    basePath: '../../../',

    // frameworks to use
    frameworks: ['jasmine'],

    // list of files / patterns to load in the browser in correct order
    // Built bundles come from esbuild/npm scripts (no Sprockets tmp/assets)
    files: [
      'app/assets/builds/jquery_bundle.js',
      // Bootstrap 5 JS and its Popper dependency are loaded via the
      // `bootstrap_globals` importmap pin in the browser (see
      // config/importmap.rb and app/javascript/bootstrap_globals.js)
      // instead of being bundled into angular_app.js. Load the same
      // vendored UMD files here so window.bootstrap/window.Popper exist
      // for specs, same as the browser gets them.
      'vendor/javascript/popper.min.js',
      'vendor/javascript/bootstrap.min.js',
      'app/assets/builds/angular_app.js',
      'app/assets/builds/quepid_angular_app.js',
      'app/assets/builds/angular_templates.js',
      'node_modules/angular-mocks/angular-mocks.js',
      'spec/karma/mockBackend.js',
      'spec/javascripts/mock/*.js',
      'spec/javascripts/**/*_spec.js'
    ],

    // list of files to exclude
    exclude: [
      '**/application2.js', // ignore importmap runtime file when running core JS app tests
    ],


    // test results reporter to use
    // possible values: 'dots', 'progress', 'junit', 'growl', 'coverage'
    reporters: ['progress'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // Start these browsers, currently available:
    // - Chrome
    // - ChromeCanary
    // - Firefox
    // - Opera (has to be installed with `npm install karma-opera-launcher`)
    // - Safari (only Mac; has to be installed with `npm install karma-safari-launcher`)
    // - PhantomJS
    // - IE (only Windows; has to be installed with `npm install karma-ie-launcher`)
    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--headless']
      }
    },


    // If browser does not capture in given timeout [ms], kill it
    captureTimeout: 60000,


    // Continuous Integration mode
    // if true, it capture browsers, run tests and exit
    singleRun: false,

    // Client configuration
    client: {
      jasmine: {
        random: false,  // Run specs in order for predictable results
        seed: null,
        stopSpecOnExpectationFailure: false
      }
    }

  });
};
