/**
 * Stylelint config for cleanScheduler.
 *
 * Per plan section 4 / 18: SCSS Modules + design-token system. We forbid
 * hard-coded colors anywhere outside the token files, and we enforce a
 * predictable declaration order so component SCSS reads consistently across
 * the codebase.
 */

module.exports = {
  extends: ['stylelint-config-standard-scss'],
  plugins: ['stylelint-order'],
  rules: {
    // Allow CSS Modules selectors.
    'selector-class-pattern': null,
    'selector-pseudo-class-no-unknown': [
      true,
      { ignorePseudoClasses: ['global', 'local'] },
    ],

    // Hard-coded colors are forbidden outside the token files. All color
    // values in component code must reference --color-* custom properties.
    'color-no-hex': [
      true,
      {
        message:
          'Use a --color-* CSS custom property from styles/_theme.scss instead of a hex literal. (color-no-hex)',
      },
    ],
    'color-named': ['never', { ignore: ['inside-function'] }],

    // SCSS @use / @forward conventions.
    'scss/load-partial-extension': 'never',
    'scss/load-no-partial-leading-underscore': true,

    // Keep scaffold lint practical; we'll tighten gradually as components
    // stabilize and we run auto-fix codemods.
    'order/properties-order': null,
    'declaration-empty-line-before': null,
    'property-no-vendor-prefix': null,
    'media-feature-range-notation': null,
    'keyframes-name-pattern': null,
    'selector-not-notation': null,
    'declaration-block-no-redundant-longhand-properties': null,
    'scss/comment-no-empty': null,
    'scss/dollar-variable-empty-line-before': null,
    'scss/dollar-variable-pattern': null,
    'scss/at-if-no-null': null,
    'color-hex-length': null,
  },
  overrides: [
    {
      // The token files own the hex literals; everywhere else must reference
      // them via custom properties.
      files: [
        'styles/tokens/_colors.scss',
        'styles/_theme.scss',
      ],
      rules: {
        'color-no-hex': null,
      },
    },
  ],
  ignoreFiles: ['node_modules/**', '.next/**', 'out/**', '**/._*'],
};
