export const defaultOptions = {
	id: `dice-canvas-${Date.now()}`, // set the canvas id
	enableShadows: true, // do dice cast shadows onto DiceBox mesh?
	delay: 10, // delay between dice being generated - 0 causes stuttering and physics popping
	gravity: 3, // high gravity will cause dice piles to jiggle
	startingHeight: 15, // height to drop the dice from - will not exceed the DiceBox height set by zoom
	spinForce: 6, // passed on to physics as an impulse force
	throwForce: 2.5, // passed on to physics as linear velocity
	zoomLevel: 3, // 0-7, can we round it out to 9? And reverse it because higher zoom means closer
	theme: '#0974e6', // can be a hex color or a pre-defined theme such as 'purpleRock'
	offscreen: true, // use offscreen canvas browser feature for performance improvements - will fallback to false based on feature detection
	assetPath: '/assets/dice-box/', // path to 'ammo', 'models', 'themes' folders and web workers
	origin: location.origin,
}

export default defaultOptions