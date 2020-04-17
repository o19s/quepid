// Karma configuration
// Generated on Fri Nov 06 2015 19:55:18 GMT+0000 (UTC)

process.env.CHROME_BIN = require('puppeteer').executablePath()

module.exports = function(config) {
  config.set({

    // base path, based on tmp/ folder
    basePath: '../',


    // frameworks to use
    frameworks: ['jasmine'],


    // list of files / patterns to load in the browser
    files: [
      'tmp/assets/application*.js',
      'tmp/assets/application_spec*.js',
      'spec/javascripts/mock/*.+(coffee|js)',
      'spec/javascripts/**/*_spec.+(coffee|js)'
    ],

    // list of files to exclude
    exclude: [

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

    // Preprocessors
    preprocessors: {
        '/**/*.coffee.erb':             'coffee',
        '/**/*.coffee':                 'coffee',
    }

  });
};
