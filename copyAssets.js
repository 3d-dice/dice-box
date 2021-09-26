'use strict'

const copydir = require('copy-dir');
const path = require('path');

const filesToCopy = ['./dist/assets']

// User's local directory
const userPath = path.join(process.env.INIT_CWD,'/public/assets')

// Moving files to user's local directory
copydir(filesToCopy, userPath)