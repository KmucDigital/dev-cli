// Main entry point
const { initCommand } = require('./commands/init');
const { deployCommand } = require('./commands/deploy');

module.exports = { initCommand, deployCommand };
