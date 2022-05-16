"use strict";

const copydir = require("copy-dir");
const path = require("path");
const fs = require("fs");

const filesToCopy = "./dist/assets";

// User's local directory
const userPath = path.join(process.env.INIT_CWD, "/public/assets");

// Creates directory if it doesn't exist
fs.mkdir(userPath, { recursive: true }, (err) => {
  if (err) throw err;

  // Moving files to user's local directory
  copydir(filesToCopy, userPath, {
    utimes: true, // keep add time and modify time
    mode: true, // keep file mode
    cover: true, // cover file when exists, default is true
  });
});
