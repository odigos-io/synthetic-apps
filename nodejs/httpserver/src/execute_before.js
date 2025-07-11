// set this global variable before running index.js, and then read it in the test.
// this file is executed with the node --require flag, so it will run before the index.js file.
// it is used on some deployments to assert that any script set to run is indeed executed before the main application.
global.executeBeforeApplied = true;
