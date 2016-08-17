const findFiles = require('./find-files')

module.exports = function () {
	return findFiles.apply(this, arguments).map(file => file.split('/').slice(0, -1).join('/'))
}
