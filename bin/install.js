#!/usr/bin/env node

const program = require('commander')

program
.version('0.0.0')
.usage('[options]')
.option('-v, --verbose', 'Enable verbose logging')
.option('-g, --glob <glob>', 'Set the glob')
.parse(process.argv)

const { glob, verbose } = program
const options = { glob, verbose }

require('../src/execute')('yarpm install', options)
