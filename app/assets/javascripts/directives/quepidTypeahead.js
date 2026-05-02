'use strict';

// Replacement for angular-ui-bootstrap's `uib-typeahead`, using
// kraaden/autocompleter (loaded onto window.autocompleter from
// app/javascript/angular_app.js).
//
// Behavioural deltas vs uib-typeahead worth knowing about:
//   - In editable=true mode the first match is NOT auto-highlighted, so
//     pressing ENTER commits the typed text rather than the (formerly
//     highlighted) first match. Less accidental selection at the cost of
//     one extra arrow-down for users who relied on the old behaviour.
//   - The `typeahead-show-hint="true"` ghost-text inline completion is not
//     implemented (kraaden has no equivalent). The dropdown still shows
//     suggestions; only the in-input ghost is gone.
//
// Two usage shapes:
//
//   1) Plain string suggestions, free-text allowed:
//        <input type="text"
//               ng-model="settings.titleField"
//               quepid-typeahead="searchFields"
//               quepid-typeahead-on-select="updateField('title', $item)"
//               quepid-typeahead-limit="8" />
//
//   2) Object suggestions with a custom row template, locked to the list:
//        <input type="text"
//               ng-model="selectedItem"
//               quepid-typeahead="searchOptions($viewValue)"
//               quepid-typeahead-label-field="name"
//               quepid-typeahead-template-url="'views/searchEndpoint_popup.html'"
//               quepid-typeahead-min-length="0"
//               quepid-typeahead-editable="false"
//               quepid-typeahead-on-select="onSelect($item)" />
//
// Attribute reference (all optional except quepid-typeahead):
//   quepid-typeahead              expression evaluated against scope with
//                                 {$viewValue: <input text>}; must return an
//                                 array (of strings or objects). Re-evaluated
//                                 on each keystroke. Substring filtering is
//                                 also applied by the directive — passing a
//                                 pre-filtered array is fine (idempotent).
//   quepid-typeahead-label-field  property name to display when items are
//                                 objects. Omit for string arrays.
//   quepid-typeahead-template-url string expression resolving to a template
//                                 URL. The template is compiled once per row
//                                 against a child scope exposing `match`
//                                 ({label, model}) and `query`. Mirrors the
//                                 uibTypeahead `match`/`query` locals so
//                                 existing partials (and the
//                                 quepidTypeaheadHighlight filter) keep working.
//   quepid-typeahead-min-length   integer; default 1. Set 0 for "open on
//                                 focus" behaviour.
//   quepid-typeahead-editable     "false" rejects input that doesn't match a
//                                 suggestion: on blur the field reverts to
//                                 the last selected value (or empty).
//   quepid-typeahead-limit        integer; default 8.
//   quepid-typeahead-on-select    expression invoked on selection with
//                                 locals {$item, $label}.
//   quepid-typeahead-no-results   assignable scope expression; set to true
//                                 after a non-empty query yields zero
//                                 matches, false otherwise. Mirrors uib's
//                                 `typeahead-no-results`.

(function () {
  angular.module('QuepidApp')
    .directive('quepidTypeahead', [
      '$parse', '$compile', '$templateRequest', '$templateCache', '$timeout',
      function ($parse, $compile, $templateRequest, $templateCache, $timeout) {
        return {
          restrict: 'A',
          require: '?ngModel',
          link: function (scope, element, attrs, ngModel) {
            const autocomplete = window.autocompleter;
            if (!autocomplete) {
              console.warn('quepidTypeahead: window.autocompleter not available; typeahead will not render', element[0]);
              return;
            }

            const input       = element[0];
            const sourceGet   = $parse(attrs.quepidTypeahead);
            const onSelectGet = attrs.quepidTypeaheadOnSelect ? $parse(attrs.quepidTypeaheadOnSelect) : null;
            const noResultsSet = attrs.quepidTypeaheadNoResults ? ($parse(attrs.quepidTypeaheadNoResults).assign || null) : null;
            const labelField  = attrs.quepidTypeaheadLabelField || null;
            const templateUrl = attrs.quepidTypeaheadTemplateUrl ? scope.$eval(attrs.quepidTypeaheadTemplateUrl) : null;
            const minLength   = attrs.quepidTypeaheadMinLength != null ? parseInt(attrs.quepidTypeaheadMinLength, 10) : 1;
            const editable    = attrs.quepidTypeaheadEditable !== 'false';
            const limit       = parseInt(attrs.quepidTypeaheadLimit, 10) || 8;

            // Cache the compiled template HTML once. The per-row scope/compile
            // runs inside render() — same as quepidPopoverTemplate. In Quepid
            // angular-rails-templates pre-populates $templateCache at boot,
            // so the cached branch always wins. The async fallback is for
            // safety; if it ever races, render falls through to plain text
            // until the template arrives — graceful, not a crash.
            let templateHtml = null;
            if (templateUrl) {
              const cached = $templateCache.get(templateUrl);
              if (cached) {
                templateHtml = cached;
              } else {
                $templateRequest(templateUrl).then(function (html) {
                  templateHtml = html;
                });
              }
            }

            function labelOf(item) {
              if (item == null) { return ''; }
              if (labelField)   { return String(item[labelField] != null ? item[labelField] : ''); }
              return String(item);
            }

            function modelOf(item) {
              return labelField ? item : labelOf(item);
            }

            function filterItems(items, query) {
              if (!Array.isArray(items)) { return []; }
              const q = (query || '').toLowerCase();
              const out = [];
              for (let i = 0; i < items.length && out.length < limit; i++) {
                const item = items[i];
                if (!q || labelOf(item).toLowerCase().indexOf(q) !== -1) {
                  out.push(item);
                }
              }
              return out;
            }

            // Track the last committed selection so editable=false can revert
            // unmatched input on blur.
            let lastCommittedLabel = '';

            // Active per-row child scopes from the most recent render pass.
            // Destroyed at the start of each new fetch (since kraaden replaces
            // the dropdown's children) and on directive teardown. Without this
            // every keystroke would leak up to `limit` scopes.
            let activeRowScopes = [];
            function destroyActiveRowScopes() {
              for (let i = 0; i < activeRowScopes.length; i++) {
                activeRowScopes[i].$destroy();
              }
              activeRowScopes = [];
            }

            // Pending blur-revert timer (editable=false), cancelled on
            // $destroy so it can't fire against torn-down scope state.
            let blurRevertPromise = null;

            function setInputText(text) {
              input.value = text || '';
              // $setViewValue runs $parsers and updates $viewValue / $modelValue;
              // we deliberately don't call $render — `input.value` was just
              // assigned above, and $setViewValue itself doesn't touch the DOM.
              if (ngModel) { ngModel.$setViewValue(input.value); }
            }

            // Bridge ng-model → input text. uib-typeahead let model and view
            // diverge (model holds the chosen object; view holds the label),
            // so we re-implement that split via a $formatter.
            if (ngModel) {
              ngModel.$formatters.push(function (value) {
                if (value == null || value === '') {
                  lastCommittedLabel = '';
                  return '';
                }
                const text = labelField ? labelOf(value) : String(value);
                lastCommittedLabel = text;
                return text;
              });

              // In object mode, suppress the default text-binding parser so
              // typing doesn't overwrite the chosen object with a partial
              // label string. In string mode, the model IS the typed string —
              // let the default $parser run so ng-change/ng-model bindings
              // fire on every keystroke (sites 2 & 3 depend on this).
              if (labelField) {
                ngModel.$parsers.push(function () { return ngModel.$modelValue; });
              }
            }

            const ac = autocomplete({
              input: input,
              minLength: minLength,
              showOnFocus: minLength === 0,
              disableAutoSelect: editable, // free-text mode: ENTER submits as-typed
              className: 'quepid-typeahead-dropdown',
              fetch: function (text, update) {
                // Tear down the previous render pass before kicking off the
                // next one — kraaden is about to replace the dropdown's DOM,
                // and any compiled child scopes from the old rows would leak.
                destroyActiveRowScopes();
                const items = sourceGet(scope, { $viewValue: text });
                Promise.resolve(items).then(function (resolved) {
                  const matches = filterItems(resolved || [], text);
                  if (noResultsSet) {
                    scope.$apply(function () {
                      noResultsSet(scope, !!text && matches.length === 0);
                    });
                  }
                  update(matches);
                });
              },
              render: function (item, currentValue) {
                const div = document.createElement('div');
                if (templateHtml) {
                  const rowScope = scope.$new(true);
                  rowScope.match = { label: labelOf(item), model: item };
                  rowScope.query = currentValue;
                  const wrap = angular.element('<div>' + templateHtml + '</div>');
                  $compile(wrap)(rowScope);
                  // Trigger a digest so interpolations (and filters like
                  // quepidTypeaheadHighlight) render before kraaden inserts the
                  // node. $applyAsync would defer past insertion.
                  rowScope.$digest();
                  div.appendChild(wrap[0]);
                  activeRowScopes.push(rowScope);
                } else {
                  div.textContent = labelOf(item);
                }
                return div;
              },
              onSelect: function (item) {
                const label = labelOf(item);
                lastCommittedLabel = label;
                input.value = label;
                scope.$apply(function () {
                  if (ngModel) { ngModel.$setViewValue(modelOf(item)); }
                  if (onSelectGet) {
                    onSelectGet(scope, { $item: item, $label: label });
                  }
                });
              }
            });

            // editable=false: snap back to last committed value if the user
            // leaves the field with non-matching text. uib-typeahead does this
            // through the same blur path.
            let blurHandler = null;
            if (!editable) {
              blurHandler = function () {
                // Defer past kraaden's own click→onSelect handling, which
                // also fires blur on the input. Track the promise so we can
                // cancel it on $destroy.
                blurRevertPromise = $timeout(function () {
                  blurRevertPromise = null;
                  if (input.value !== lastCommittedLabel) {
                    setInputText(lastCommittedLabel);
                  }
                }, 150);
              };
              input.addEventListener('blur', blurHandler);
            }

            scope.$on('$destroy', function () {
              if (blurHandler) { input.removeEventListener('blur', blurHandler); }
              if (blurRevertPromise) { $timeout.cancel(blurRevertPromise); }
              destroyActiveRowScopes();
              if (ac && typeof ac.destroy === 'function') { ac.destroy(); }
            });
          }
        };
      }
    ]);
})();
