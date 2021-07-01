angular.module('QuepidApp')
  .component('changeRatingsView', {
    controller:   'ChangeRatingsViewCtrl',
    controllerAs: 'ctrl',
    templateUrl:  'change_ratings_view/change_ratings_view.html',
    bindings:     {
      acase:    '<',
      iconOnly: '<',
    },
  });
