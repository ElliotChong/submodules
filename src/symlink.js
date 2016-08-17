/* eslint-disable no-console */

const Promise = require('bluebird')
const map = require('lodash/map')
const merge = require('lodash/merge')
const { resolve } = require('path')
const { lstatSync, makeTreeAsync, readdirAsync, statAsync, symlinkSync } = Promise.promisifyAll(require('fs-plus'))
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
	.then((folders) => {
		// Inject the top-most folder
		folders.unshift(options.cwd)

		// Create a tree of folders
		const tree = createTree(folders)

		// Walk the tree and record the executables to symlink
		const executables = []

		const walk = (branch, path) => {
			// Convert the branch into an Array of key / value pairs
			const spreadBranch = map(branch, (value, key) => {
				return { pathSegment: key, branch: value }
			})

			// Reached the end of the tree
			if (spreadBranch.length === 0) {
				return Promise.resolve(branch)
			}

			// Iterate over the sub-branches of the branch
			return Promise.map(spreadBranch, ({ branch, pathSegment }) => {
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

					// Read all of executables within the directory
					return readdirAsync(binPath)
					// Convert the paths to absolute
					.map((file) => {
						return resolve(binPath, file)
					})
					// Record all of executables
					.then((files) => {
						executables.push({
							path: resolvedPath,
							files
						})
					})
					// Continue walking the tree
					.then(() => {
						return walk(branch, resolvedPath)
					})
				})
			}).finally(() => {
				return branch
			})
		}

		return walk(tree, '/')
		.then(() => { return [folders, executables] })
	})
	// Create symlinks if a path doesn't already exsist
	.spread((folders, executables) => {
		return Promise.map(folders, (folder) => {
			return Promise.map(executables, ({ path, files }) => {
				// Check if the path is a parent of the folder
				if (folder === path || folder.includes(path) === false) {
					return
				}

				const binFolder = resolve(folder, 'node_modules/.bin')

				// Ensure `node_modules/.bin` exists within `folder`
				return makeTreeAsync(binFolder)
				.then(() => {
					return Promise.map(files, (file) => {
						const destination = resolve(binFolder, file.split('/').pop())

						try {
							var stat = lstatSync(destination)
						} catch (error) {
							// Handle known errors
							if (error.message.includes('ENOENT: no such file or directory') === false) {
								throw error
							}
						}

						// Ensure the file doesn't already exist
						if (stat != null) {
							return
						}

						if (verbose) {
							console.log(`Creating a symbolic link from ${file} to ${destination}`)
						}

						// Create a symbolic link
						try {
							return symlinkSync(file, destination)
						} catch (error) {
							// Handle known errors
							if (error.message.includes('EEXIST: file already exists')) {
								return
							}

							throw error
						}
					})
				})
			})
		})
	})
}
