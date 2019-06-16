do ->
  'use strict'

  $('[data-pulse]').each ->
    div         = $(this)
    selector    = div.data('item-selector')
    url         = div.data('url')
    date        = div.data('signup-date')
    signup_date = new Date(date)

    now        = new Date
    start_date = new Date 1900+now.getYear(), now.getMonth() - 11, 1

    cal = new CalHeatMap()
    cal.init {
      cellSize:     20,
      data:         "#{url}&start={{d:start}}&end={{d:end}}",
      dataType:     'json',
      domain:       'month',
      highlight:    [ 'now', signup_date],
      itemSelector: selector,
      start:        start_date,
      subDomain:    'day',
    }

  return
