/* eslint no-console:0 */
// This file is automatically compiled by Webpack, along with any other files
// present in this directory. You're encouraged to place your actual application logic in
// a relevant structure within app/javascript and only use these pack files to reference
// that code so it'll be compiled.
//
// To reference this file, add <%= javascript_pack_tag 'application' %> to the appropriate
// layout file, like app/views/layouts/application.html.erb


// Uncomment to copy all static images under ../images to the output folder and reference
// them with the image_pack_tag helper in views (e.g <%= image_pack_tag 'rails.png' %>)
// or the `imagePath` JavaScript helper below.
//
// const images = require.context('../images', true)
// const imagePath = (name) => images(name, true)

console.log('Hello World from Webpacker: admin_webpack.js')

import 'core-js/stable'
import 'regenerator-runtime/runtime'

import 'jquery'
import 'popper.js'
import 'bootstrap'
import 'jquery-ujs'
import 'jquery-ui'
import d3 from 'd3'

import 'cal-heatmap/cal-heatmap'

import 'ace-builds/src-min-noconflict/ace'
import 'ace-builds/src-min-noconflict/ext-language_tools'
//import 'ace-builds/src-min-noconflict/mode-json'
import 'ace-builds/src-min-noconflict/mode-javascript'
import 'ace-builds/src-min-noconflict/theme-chrome'
//ace.config.setModuleUrl("ace/mode/json_worker", require("file-loader!ace-builds/src-noconflict/worker-json.js"))
ace.config.setModuleUrl("ace/mode/javascript_worker", require("file-loader!ace-builds/src-noconflict/worker-javascript.js"))

import 'scorers'
import 'user_pulse'

import '../stylesheets/admin_webpack.scss'
