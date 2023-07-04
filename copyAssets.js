import copydir from 'copy-dir'
import path from 'path'
import fs from 'fs'
import readline from 'readline'
import { stdin as input, stdout as output } from 'process'

import { AbortController } from 'node-abort-controller' //polyfill for Node <v14

const ac = new AbortController();
const signal = ac.signal;

const filesToCopy = './dist/assets'
let staticPath = '/public/assets'

// creat prompt asking for static folder
const rl = readline.createInterface({ input, output });

const writeFiles = (path) => {
  // Creates directory if it doesn't exist
  fs.mkdir(path, { recursive: true }, (err) => {
    if (err) throw err;
    
    // Moving files to user's local directory
    copydir(filesToCopy, path, {
      utimes: true,  // keep add time and modify time
      mode: true,    // keep file mode
      cover: true    // cover file when exists, default is true
    })
  });
}

rl.question('Path to your static assets folder (press "Enter" for /public/assets): ', (answer) => {
  answer = answer || staticPath
  console.log(`Copying assets to: ${answer}`);

  writeFiles(path.join(process.env.INIT_CWD,answer))

  rl.close();
});

signal.addEventListener('abort', () => {
  console.log(`Question timeout. Using default: ${staticPath}`);
  writeFiles(path.join(process.env.INIT_CWD,staticPath))
  rl.close();
}, { once: true });

setTimeout(() => ac.abort(), 10000);
