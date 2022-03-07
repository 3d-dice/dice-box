export function lerp(a: number, b: number, alpha: number) {
  return a * (1 - alpha) + b * alpha;
}

/**
 * Create UUIDs 
 * @return {string} Unique UUID
 */
export const createUUID = (): string => {
	//@ts-expect-error ignore this
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, (c: number) => {
    const crypto = window.crypto || window.Crypto
    //eslint-disable-next-line
    return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  })
}

export const recursiveSearch = (obj: { [x: string]: any; }, searchKey: string, results: unknown[] = []) => {
	const r = results;
	Object.keys(obj).forEach(key => {
		const value: unknown = obj[key];
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
export const debounce = (fn: { (): void; apply?: any; }) => {

	// Setup a timer
	let timeout: number;

	// Return a function to run debounced
	return function () {

		// Setup the arguments
		//@ts-expect-error this is throwing error
		const context: unknown = this;
		const args = arguments;

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