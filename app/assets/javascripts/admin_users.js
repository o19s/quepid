// Known issue that cal-heatmap (and d3) are super old and require old jquery.
// Meanwhile, bootstrap/dist/js/bootstrap.bundle is Bootstrap 5, which doesn't not like
// the version of jquery that we use.  So this means the dropdown in the header nav does not
// work.  However, this is only on the /admin/users/3 show view, so we live with it.

//= require jquery
//  
//= require bootstrap/dist/js/bootstrap.bundle

//= require d3
//= require cal-heatmap

//= require admin/scorers
//= require admin/user_pulse
