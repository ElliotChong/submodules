/* eslint-disable no-console */

const Promise = require('bluebird')
const map = require('lodash/map')
const merge = require('lodash/merge')
const { resolve } = require('path')
const { lstatAsync, statAsync, readdirAsync, unlinkAsync } = Promise.promisifyAll(require('fs-plus'))
const findFolders = require('./util/find-folders')
const createTree = require('./util/create-tree')

const defaultOptions = {
	glob: '!(node_modules)/**/package.json',
	cwd: process.cwd(),
	filter: file => file.includes('node_modules') === false
}

module.exports = (options) => {
	const { glob, verbose } = options = merge({}, defaultOptions, options)

	// Gather all submodule folders
	findFolders(glob, options)
	// Inject the top-most folder
	.then((folders) => {
		folders.unshift(options.cwd)

		return folders
	})
	// Create a tree of folders
	.then(createTree)
	// Walk the tree and remove broken symlinks
	.then((tree) => {
		const walk = (branch, path) => {
			// Convert the branch into an Array of key / value pairs
			branch = map(branch, (value, key) => {
				return { pathSegment: key, branch: value }
			})

			// Reached the end of the tree
			if (branch.length === 0) {
				return Promise.resolve()
			}

			// Iterate over the sub-branches of the branch
			return Promise.map(branch, ({ branch, pathSegment }) => {
				const resolvedPath = resolve(path, pathSegment)
				const binPath = resolve(resolvedPath, 'node_modules/.bin')

				return statAsync(binPath)
				// Handle known errors
				.catch((error) => {
					if (error.message.includes('ENOENT: no such file or directory')) {
						return
					}

					throw error
				})
				.then((stat) => {
					// Handle `node_modules/.bin` not existing or not being a folder
					if (stat == null || stat.isDirectory() === false) {
						// Continue walking the tree
						return walk(branch, resolvedPath)
					}

					if (verbose) {
						console.log(`Checking for broken symlinks @ ${binPath}`)
					}

					// List all files within the directory and remove any broken symlinks
					return readdirAsync(binPath).map((file) => {
						const resolvedPath = resolve(binPath, file)

						return lstatAsync(resolvedPath)
						.then((stat) => {
							// Ignore non-symbolic links
							if (stat.isSymbolicLink() === false) {
								return
							}

							return statAsync(resolvedPath)
							.catch(() => {
								if (verbose) {
									console.log(`Removing dead smylink @ ${resolvedPath}`)
								}

								return unlinkAsync(resolvedPath)
							})
						})
					})
					// Continue walking the tree
					.finally(() => {
						walk(branch, resolvedPath)
					})
				})
			})
		}

		return walk(tree, '/')
	})
}
