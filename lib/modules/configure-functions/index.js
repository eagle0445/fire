'use strict';

exports = module.exports = ConfigureFunctions;

var Q = require('q');

/**
 * The configure module creates App#configure which...:
 *
 * Sets a configure function to be run in the server-context right before the app starts. This is useful because code may be invoked when generating code, migrations and so on. The configureFunction is guaranteed only to be run when the app starts.
 *
 * You may invoke this method multiple times to configure multiple functions. If you return a promise, the start up of the app continues once the promise resolves.
 */
function ConfigureFunctions(app) {
	this.configureFunctions = [];
	this.app = app;

	var self = this;
	app.configure = function(configureFunction) {
		if(self.configureFunctions === null) {
			configureFunction.call(app, (process.env.NODE_ENV || 'development'));
		}
		else {
			self.configureFunctions.push(configureFunction);
		}

		return app;
	};
}

/**
 * Executes all App#configure functions.
 */
ConfigureFunctions.prototype.start = function() {
	var environment = (process.env.NODE_ENV || 'development');

	var result = Q.when(true);

	var self = this;
	this.configureFunctions.forEach(function(configureFunction) {
		result = result.then(function() {
			// TODO: Should this get called in web or worker processes? or in tasks too?
			return Q.when(configureFunction.call(self.app, environment));
		});
	});

	return result
		.then(function() {
			self.configureFunctions = null;
		});
};