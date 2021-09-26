'use strict'

const copydir = require('copy-dir');
const path = require('path');

const filesToCopy = ['./dist/assets']

// User's local directory
const userPath = path.join(process.env.INIT_CWD,'/public/assets', {
  utimes: true,  // keep add time and modify time
  mode: true,    // keep file mode
  cover: true    // cover file when exists, default is true
})

// Moving files to user's local directory
copydir(filesToCopy, userPath)