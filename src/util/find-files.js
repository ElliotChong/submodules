/* eslint-disable no-console */

const Promise = require('bluebird')
const glob = Promise.promisify(require('glob'))
const { resolve } = require('path')

module.exports = (globPattern, options) => {
	if (globPattern == null) {
		throw new Error('`globPattern` is a required parameter.')
	}

	const { filter } = options
	let { cwd } = options
	cwd = cwd || process.cwd()

	// Find all files which match the glob
	let promise = glob(globPattern, { cwd })

	if (filter) {
		// Remove any files according to the supplied filter
		promise = promise.filter(filter)
	}

	// Convert to an absolute path
	return promise.map((file) => {
		return resolve(cwd, file)
	})
}
