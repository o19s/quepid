const { environment } = require('@rails/webpacker')
const coffee =  require('./loaders/coffee')

// see https://www.botreetechnologies.com/blog/introducing-jquery-in-rails-6-using-webpacker
const webpack = require('webpack')
environment.plugins.prepend('Provide',
  new webpack.ProvidePlugin({
    $: 'jquery/src/jquery',
    jQuery: 'jquery/src/jquery',
    CalHeatMap: "cal-heatmap"
  })
)
environment.loaders.prepend('coffee', coffee)
module.exports = environment
