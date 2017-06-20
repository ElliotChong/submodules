/* eslint-disable no-console */

const Promise = require('bluebird')
const merge = require('lodash/merge')
const exec = Promise.promisify(require('child_process').exec)
const findFolders = require('./util/find-folders')
const { green, red } = require('colors/safe')

const defaultOptions = {
	glob: '!(node_modules)/**/package.json',
	cwd: process.cwd(),
	filter: file => file.includes('node_modules') === false,
	killParent: true
}

module.exports = (command, options) => {
	if (command == null) {
		throw new Error('`command` is a required parameter.')
	}

	const { glob, verbose, killParent } = options = merge({}, defaultOptions, options)

	return findFolders(glob, options)
	// Execute a command on all folders that contain a `package.json` file
	.map(folder => {
		if (verbose) {
			console.log(`Executing '${command}' @ ${folder}`)
		}

		return exec(command, {
			cwd: folder
		})
		.then((stdout, stderr) => {
			if (verbose) {
				if (stdout) {
					console.log(`\n${green(stdout)}`)
				}

				if (stderr) {
					console.error(`\n${red(stderr)}`)
				}
			}
		})
		.catch((error) => {
			console.error(error.cause || error)

			// Kill the parent process if a child process exits with an error
			if (killParent === true) {
				process.exit(error.code || 1)
			}
		})
	})
}
