// Load all the channels within this directory and all subdirectories.
// Channel files must be named *_channel.js.
// NOTE NOT USED TODAY BECAUSE WE ARE SOMEHOW NOT HIP WIHT THIS BUILD TOOL AND MORE LIKE RAILS 5
const channels = require.context('.', true, /_channel\.js$/)
channels.keys().forEach(channels)
