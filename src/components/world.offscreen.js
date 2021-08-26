import worldWorker from './offscreenCanvas.worker?worker'

let offscreenCanvas, offscreenWorker, offscreenWorkerInit

class WorldOffScreen{
	constructor(options){
		this.initialized = false
		this.onInitComplete = () => {}
		this.onRollResult = () => {}
		this.onRollComplete = () => {}

		offscreenCanvas = options.canvas.transferControlToOffscreen()

		// initialize 3D World in which BabylonJS runs
		offscreenWorker = new worldWorker()
		// need to initialize the web worker and get confirmation that initialization is complete before other scripts can run
		// set a property on the worker to a promise that is resolve when the proper message is returned from the worker
		offscreenWorker.init = new Promise((resolve, reject) => {
			offscreenWorkerInit = resolve
		})

		this.initScene(options)
	}

	// initialize the babylon scene
	async initScene(options) {
		let canvas = options.canvas
	
		// set the config from World
		this.config = options.options

		// initalize the offscreen worker
		offscreenWorker.postMessage({
			action: "init",
			canvas: offscreenCanvas,
			width: canvas.clientWidth,
			height: canvas.clientHeight,
			options: this.config,
		}, [offscreenCanvas])

		// handle messages from offscreen BabylonJS World
		offscreenWorker.onmessage = (e) => {
			switch( e.data.action ) {
				case "init-complete":
					offscreenWorkerInit() //fulfill promise so other things can run
					break;
				case 'roll-result':
					const die = e.data.die
					// map die results back to our rollData
					// this.rollData[die.groupId].rolls[die.rollId].result = die.result
					// TODO: die should have 'sides' or is that unnecessary data passed between workers?
					this.onRollResult(die)
					break;
				case 'roll-complete':
					// this.onRollComplete(this.getRollResults())
					this.onRollComplete()
					break;
			}
		}
		await Promise.all([offscreenWorker.init])

		this.onInitComplete(true)
	}

	connect(port){
		// Setup the connection: Port 1 is for offscreenWorker
		offscreenWorker.postMessage({
			action : "connect",
		},[ port ])
	}

	resize(options){
		offscreenWorker.postMessage({action: "resize", ...options});
	}

	clear(){
		offscreenWorker.postMessage({action: "clearDice"})
	}

	add(options){
		offscreenWorker.postMessage({
			action: "addDie",
			options // TODO: other methods do not pass options object. Instead they are spread out
		})
	}

	remove(options){
		// remove the die from the render
		offscreenWorker.postMessage({action: "removeDie", ...options})
	}
}

export default WorldOffScreen