/** Stylelint config for Quepid-authored `.css` (see `yarn lint:css`). */
export default {
  extends: ['stylelint-config-recommended'],
  rules: {
    // Large legacy sheets rely on source order; reordering risks subtle regressions.
    'no-descending-specificity': null,
    // Angular / AngularJS components and directives used as element selectors.
    'selector-type-no-unknown': [
      true,
      {
        ignoreTypes: [
          'queries',
          'qgraph',
          'qscore-query',
          'qscore-case',
          'tags-input',
          'query-params',
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['**/signup.css'],
      rules: {
        // Vendored Bootstrap Social button rules repeat selectors for cascade (minified pattern).
        'no-duplicate-selectors': null,
      },
    },
  ],
};
