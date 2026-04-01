/** PostCSS config (CommonJS) — avoids edge cases where .mjs is not picked up. */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
