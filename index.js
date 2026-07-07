const DJSBot = require("./src/DJSBot");
const builds = require("./src/builds/$");
const components = require("./src/components/$");

module.exports = {
  DJSBot,
  ...builds,
  ...components,
};
