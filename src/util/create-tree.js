module.exports = (folders) => {
	return folders.reduce((tree, folder) => {
		folder.split('/').reduce((branch, segment, index, length) => {
			branch[segment] = branch[segment] || {}

			return branch[segment]
		}, tree)

		return tree
	}, {})
}
