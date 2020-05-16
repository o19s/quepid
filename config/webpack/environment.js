const { environment } = require('@rails/webpacker')
const coffee =  require('./loaders/coffee')

const webpack = require('webpack')

environment.plugins.prepend('Provide',
  new webpack.ProvidePlugin({
    $: 'jquery/src/jquery',
    jQuery: 'jquery/src/jquery',
    CalHeatMap: 'cal-heatmap',
//    Popper: ['popper.js', 'default']
    Popper: ['popper.js']
  })
)


environment.loaders.prepend('coffee', coffee)
module.exports = environment
