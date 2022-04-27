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