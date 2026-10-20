// Extends app.json. WEB_BASE_PATH sets the URL path the web build is served
// from, e.g. "/Rank-the-song" on GitHub Pages; leave it unset for a root domain.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.WEB_BASE_PATH ? { baseUrl: process.env.WEB_BASE_PATH } : {}),
  },
});
