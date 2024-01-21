export function lerp(a, b, alpha) {
  return a * (1 - alpha) + b * alpha;
}

/**
 * Create UUIDs 
 * @return {string} Unique UUID
 */
export const createUUID = () => {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => {
    const crypto = window.crypto || window.msCrypto
    //eslint-disable-next-line
    return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  })
}

export const recursiveSearch = (obj, searchKey, results = []) => {
	const r = results;
	Object.keys(obj).forEach(key => {
		const value = obj[key];
		// if(key === searchKey && typeof value !== 'object'){
		if(key === searchKey){
			r.push(value);
		} else if(value && typeof value === 'object'){
			recursiveSearch(value, searchKey, r);
		}
	});
	return r;
};

/**
 * Debounce functions for better performance
 * (c) 2021 Chris Ferdinandi, MIT License, https://gomakethings.com
 * @param  {Function} fn The function to debounce
 */
export const debounce = (fn) => {

	// Setup a timer
	let timeout;

	// Return a function to run debounced
	return function () {

		// Setup the arguments
		let context = this;
		let args = arguments;

		// If there's a timer, cancel it
		if (timeout) {
			window.cancelAnimationFrame(timeout);
		}

		// Setup the new requestAnimationFrame()
		timeout = window.requestAnimationFrame(function () {
			fn.apply(context, args);
		});
	};
}

/**
 * Function Queue - ensures async function calls are triggered in the order they are queued
 * By David Adler (david_adler) @ https://stackoverflow.com/questions/53540348/js-async-await-tasks-queue
 * @param  {object} opts Option to dedupe concurrent executions
 * @return {object} returns object with "push" function, "queue" array, and "flush" function
 */
export const createAsyncQueue = (opts = { dedupe: false }) => {
  const { dedupe } = opts
  let queue = []
  let running
  const push = task => {
    if (dedupe) queue = []
    queue.push(task)
    if (!running) running = start()
    return running.finally(() => {
      running = undefined
    })
  }
  const start = async () => {
    const res = []
    while (queue.length) {
      const item = queue.shift()
      res.push(await item())
    }
    return res
  }
  return { push, queue, flush: () => running || Promise.resolve([]) }
}

// deep copy objects and break references to original object
// Note: does not work with the 'scene' object or objects with circular references
export const deepCopy = obj => JSON.parse(JSON.stringify(obj))

// Sleeper function to delay execution for testing
export const sleeper = (ms) => {
  return new Promise(resolve => setTimeout(() => resolve(), ms));
}

export class Random {
  /**
   * Generate a random number between 0 (inclusive) and 1 (exclusive).
   * A drop in replacement for Math.random()
   * @return {number}
   */
  static value() {
    const crypto = window.crypto || window.msCrypto;
    const buffer = new Uint32Array(1);
    const int = crypto.getRandomValues(buffer)[0];

    return int / 2**32
  }
  /**
   * Generate a very good random number between min (inclusive) and max (exclusive) by using crypto.getRandomValues() twice.
   * @param  {number} min
   * @param  {number} max
   * @return {number}
   */
  static range(min, max) {
    // return Math.floor(this.value() * (max - min) + min); // plain random
    return (Math.floor(Math.pow(10,14)*this.value()*this.value())%(max-min+1))+min // super random!
  }
}

// https://www.30secondsofcode.org/c/js-colors/p/1
export const hexToRGB = hex => {
  let alpha = false,
    h = hex.slice(hex.startsWith('#') ? 1 : 0);
  if (h.length === 3) h = [...h].map(x => x + x).join('');
  else if (h.length === 8) alpha = true;
  h = parseInt(h, 16);
  let val = {
    r: h >>> 16,
    g: (h & 0x00ff00) >>> 8,
    b: (h & 0x0000ff)
  }
  if(alpha) {
    val.r = h >>> 24
    val.g = (h & 0x00ff0000) >>> 16
    val.b = (h & 0x0000ff00) >>> 8
    val.a = (h & 0x000000ff)
  }
  return val

};

export const RGBToHSB = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const v = Math.max(r, g, b),
    n = v - Math.min(r, g, b);
  const h =
    n === 0 ? 0 : n && v === r ? (g - b) / n : v === g ? 2 + (b - r) / n : 4 + (r - g) / n;
  return [60 * (h < 0 ? h + 6 : h), v && (n / v) * 100, v * 100];
};

export const hexToHSB = (hex) => {
  const rgb = hexToRGB(hex)
  return RGBToHSB(rgb.r,rgb.g,rgb.b)
}

export function webgl_support () {
  try {
    const canvas = document.createElement('canvas'); 
    return !!window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch(e) {
    return false;
  }
}