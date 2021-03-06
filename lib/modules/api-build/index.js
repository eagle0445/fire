'use strict';

var mu = require('mu2');
var Q = require('q');
var path = require('path');
var inflection = require('inflection');
var stream = require('stream');
var utils = require('./../../helpers/utils');

exports = module.exports = APIBuild;

function modelMap(model) {
	var properties = [];
	var propertiesMap = model.getAllProperties();
	Object.keys(propertiesMap).forEach(function(propertyName) {
		var property = propertiesMap[propertyName];

		if(!property.options.isPrivate) {
			properties.push({
				name: property.name,
				resource: inflection.transform(property.name, ['underscore', 'dasherize']).toLowerCase(),
				capitalName: inflection.capitalize(property.name),

				singularName: utils.ucfirst(inflection.singularize(property.name)),
				pluralName: utils.ucfirst(inflection.pluralize(property.name)),

				isManyToMany: property.isManyToMany(),
				isOneToMany: !property.isManyToMany() && !!property.options.hasMany,
				isOneToOne: !!property.options.belongsTo || !!property.options.hasOne,
				hasMany: !!property.options.hasMany,

				throughModelDependencyName: property.options.through ? (property.options.through.getName() + 'Model') : null
			});
		}
	});

	var authenticator = model.models.getAuthenticator();

	return {
		name: model.getName(),
		dependencyName: model.getName() + 'Model',
		authenticatorDependencyName: authenticator ? authenticator.getName() + 'Model' : null,
		authenticatingPropertyName: model.options.authenticatingProperty ? model.options.authenticatingProperty.name : null,
		isAuthenticator: model.isAuthenticator(),
		isPasswordBasedAuthenticator: model.isAuthenticator() && model.options.isPasswordBased,
		isPasswordlessAuthenticator: model.isAuthenticator() && !model.options.isPasswordBased,
		resourceName: inflection.transform(model.getName(), ['tableize', 'dasherize']).toLowerCase(),
		pluralName: inflection.pluralize(model.getName()),
		lowerCaseName: inflection.camelize(model.getName(), true),
		properties: properties
	};
}

/**
 * The API module.
 *
 * This module generates model controllers of all models during build phase and executes the controllers in the run phase. The model controllers get generated to /.fire/.build/api. To generate the model controllers:
 *
 * ```
 * $ grunt build
 * ```
 *
 * @access private
 *
 * @param {App} app The app.
 * @constructor
 * @memberof APIBuild
 */
function APIBuild(app) {
	this.stages = ['build'];

	/**
	 * Writes the model controller of `model` to `writeStream`.
	 *
	 * Once this method finishes, it does close the `writeStream`.
	 *
	 * @param {Model} model       The model.
	 * @param {fs.Writable} writeStream The write stream to write to.
	 */
	this.generateModelController = function(model, writeStream) {
		var defer = Q.defer();

		if(model.isPrivate) {
			defer.resolve(null);
		}
		else {
			var readStream = mu.compileAndRender(path.join(__dirname, 'templates', 'model-controller.js'), {
				fire: process.env.NODE_ENV === 'test' ? './..' : 'fire',
				model: modelMap(model),
				controllerName: model.getName() + 'ModelController',
				appId: app.container.id,
				appName: app.name
			});

			var errorCallback = function(error) {
				removeEventListeners();

				defer.reject(error);
			};
			var successCallback = function() {
				removeEventListeners();

				defer.resolve(false);
			};

			var removeEventListeners = function() {
				readStream.removeListener('end', successCallback);
				writeStream.removeListener('error', errorCallback);
				writeStream.removeListener('finish', successCallback);
			};

			writeStream.once('error', errorCallback);
			readStream.once('error', errorCallback);

			if(writeStream instanceof stream.Writable) {
				writeStream.once('finish', successCallback);
			}
			else {
				// The memory stream unfortunately does not emit the finish event. Instead, we'll listen when reading ends.
				readStream.once('end', successCallback);
			}

			readStream.pipe(writeStream);
		}

		return defer.promise;
	};
}
