import { createEngine } from './engine'
import { createScene } from './scene'
import { createCamera } from './camera'
import { createLights } from './lights'
import DiceBox from './DiceBox'
import Dice from './Dice'
import { loadTheme } from './Dice/themes'

let 
	config,
	dieCache = {},
	count = 0,
	sleeperCount = 0,
	dieRollTimer = [],
	canvas, 
	engine, 
	scene, 
	camera,
	lights,
	diceBox,
	physicsWorkerPort,
	diceBufferView = new Float32Array(8000)

// these are messages sent to this worker from World.js
self.onmessage = (e) => {
  switch( e.data.action ) {
    case "rollDie":
      // kick it over to the physics worker
      physicsWorkerPort.postMessage({
        action: "roll"
      })
      break
    case "addDie":
			add({...e.data.options})
      break
		case "loadTheme":
			loadThemes(e.data.id,e.data.theme)
			break
    case "clearDice":
			clear()
      break
		case "removeDie":
			remove(e.data.options)
			break;
    case "resize":
			resize(e.data.options)
      break
    case "init":
      initScene(e.data)
      break
		case "updateConfig":
			updateConfig(e.data.options)
			break
    case "connect": // These are messages sent from physics.worker.js
      physicsWorkerPort = e.data.port
      physicsWorkerPort.onmessage = (e) => {
        switch (e.data.action) {
          case "updates": // dice status/position updates from physics worker
						updatesFromPhysics(e.data.diceBuffer)
            break;
        
          default:
            console.error("action from physicsWorker not found in offscreen worker")
            break;
        }
      }
      break
    default:
      console.error("action not found in offscreen worker")
  }
}

// initialize the babylon scene
const initScene = async (data) => {
	canvas = data.canvas

	// set the config from World
	config = data.options
	canvas.width = data.width
	canvas.height = data.height

	// setup babylonJS scene
	engine = createEngine(canvas)
  scene = createScene({engine})
  camera = createCamera({engine, zoomLevel: config.zoomLevel})
  lights = createLights({enableShadows: config.enableShadows})

  // create the box that provides surfaces for shadows to render on
	diceBox = new DiceBox({
		enableShadows: config.enableShadows,
    zoomLevel: config.zoomLevel,
    aspect: canvas.width / canvas.height,
    lights,
		scene
	})
  
  // loading all our dice models
  // we use to load these models individually as needed, but it's faster to load them all at once and prevents animation jank when rolling
  await Dice.loadModels({
		assetPath: config.origin + config.assetPath,
		scene
	})

	physicsWorkerPort.postMessage({
		action: "initBuffer",
		diceBuffer: diceBufferView.buffer
	}, [diceBufferView.buffer])

  // init complete - let the world know
  self.postMessage({action:"init-complete"})
}

const updateConfig = (options) => {
	const prevConfig = config
	config = options
	// check if zoom level has changed
	if(prevConfig.zoomLevel !== config.zoomLevel){
		// redraw the DiceBox for shadows shader
		diceBox.destroy()
		diceBox = new DiceBox({
			...config,
			zoomLevel: config.zoomLevel,
			aspect: canvas.width / canvas.height,
			lights,
			scene
		})
		// redraw the camera which changes position based on zoomLevel value
		camera.dispose()
		camera = createCamera({engine, zoomLevel: config.zoomLevel})
	}
	// check if shadows setting has changed
	if(prevConfig.enableShadows !== config.enableShadows) {
		Object.values(lights).forEach(light => light.dispose())
		lights = createLights({enableShadows: config.enableShadows})
	}
}

// all this does is start the render engine.
const render = () => {
  // document.body.addEventListener('click',()=>engine.stopRenderLoop())
  engine.runRenderLoop(renderLoop.bind(self))
	physicsWorkerPort.postMessage({
		action: "resumeSimulation",
	})
}

const renderLoop = () => {
  // if no dice awake then stop the render loop and save some CPU power (unless we're in debug mode where we want the arc camera to continue working)
  if(sleeperCount && sleeperCount === Object.keys(dieCache).length) {
    // console.info(`no dice moving`)
    engine.stopRenderLoop()
		count = 0
		// stop the physics engine
    physicsWorkerPort.postMessage({
      action: "stopSimulation",
    })
		// post back to the world
		self.postMessage({
			action: "roll-complete"
		})
  }
  // otherwise keep on rendering
  else {
    scene.render()
  }
}

const loadThemes = async (id,theme) => {
	await loadTheme(theme, config.origin + config.assetPath, scene)
	self.postMessage({action:"theme-loaded",id})
}

const clear = () => {
	if(!Object.keys(dieCache).length && !sleeperCount) {
		return
	}
	if(diceBufferView.byteLength){
		diceBufferView.fill(0)
	}
	dieRollTimer.forEach(timer=>clearTimeout(timer))
	// stop anything that's currently rendering
	engine.stopRenderLoop()
	// remove all dice
	// dieCache.forEach(die => die.mesh.dispose())
	Object.values(dieCache).forEach(die => die.mesh.dispose())

	dieCache = {}
	count = 0
	sleeperCount = 0

	// step the animation forward
	scene.render()

}

const add = (options) => {
	// loadDie allows you to specify sides(dieType) and theme and returns the options you passed in
	Dice.loadDie({
		...options,
		scene
	}).then(resp => {
		// space out adding the dice so they don't lump together too much
		dieRollTimer.push(setTimeout(() => {
			_add(resp)
		}, count++ * config.delay))
	})
}

// add a die to the scene
const _add = async (options) => {
	if(engine.activeRenderLoops.length === 0) {
		render()
	}

	const diceOptions = {
		...options,
		assetPath: config.assetPath,
		enableShadows: config.enableShadows,
		lights,
	}

  const newDie = new Dice(diceOptions)

  // save the die just created to the cache
  dieCache[newDie.id] = newDie

	// tell the physics engine to roll this die type - which is a low poly collider
	physicsWorkerPort.postMessage({
		action: "addDie",
		sides: options.sides,
		id: newDie.id
	})

  // for d100's we need to add an additional d10 and pair it up with the d100 just created
  if(options.sides === 100) {
    // assign the new die to a property on the d100 - spread the options in order to pass a matching theme
    newDie.d10Instance = await Dice.loadDie({...diceOptions, sides: 10, id: newDie.id + 10000}).then( response =>  {
      const d10Instance = new Dice(response)
      // identify the parent of this d10 so we can calculate the roll result later
      d10Instance.dieParent = newDie
      return d10Instance
    })
    // add the d10 to the cache and ask the physics worker for a collider
    dieCache[`${newDie.d10Instance.id}`] = newDie.d10Instance
    physicsWorkerPort.postMessage({
      action: "addDie",
      sides: 10,
			id: newDie.d10Instance.id
    })
  }

  // return the die instance
  return newDie

}

const remove = (data) => {
	// TODO: test this with exploding dice
	// remove die
	dieCache[data.id].mesh.dispose()
	// delete entry
	delete dieCache[data.id]
	// decrement count
	sleeperCount--

	// step the animation forward
	scene.render()
}

const updatesFromPhysics = (buffer) => {
	diceBufferView = new Float32Array(buffer)
	let bufferIndex = 1

	// loop will be based on diceBufferView[0] value which is the bodies length in physics.worker
	for (let i = 0, len = diceBufferView[0]; i < len; i++) {
		if(!Object.keys(dieCache).length){
			continue
		}
		const die = dieCache[`${diceBufferView[bufferIndex]}`]
		// if the first position index is -1 then this die has been flagged as asleep
		if(diceBufferView[bufferIndex + 1] === -1) {
			handleAsleep(die)
		} else {
			const px = diceBufferView[bufferIndex + 1]
			const py = diceBufferView[bufferIndex + 2]
			const pz = diceBufferView[bufferIndex + 3]
			const qx = diceBufferView[bufferIndex + 4]
			const qy = diceBufferView[bufferIndex + 5]
			const qz = diceBufferView[bufferIndex + 6]
			const qw = diceBufferView[bufferIndex + 7]

			die.mesh.position.set(px, py, pz)
			die.mesh.rotationQuaternion.set(qx, qy, qz, qw)
		}

		bufferIndex = bufferIndex + 8
	}

	// transfer the buffer back to physics worker
	requestAnimationFrame(()=>{
		physicsWorkerPort.postMessage({
			action: "stepSimulation",
			diceBuffer: diceBufferView.buffer
		}, [diceBufferView.buffer])
	})
}

const handleAsleep = async (die) => {
	// mark this die as asleep
	die.asleep = true

	// get the roll result for this die
	let result = await Dice.getRollResult(die)
	// TODO: results are based on which mesh face is pointing up. Not all of them are mapped to number values such as edges (especially d10 and d100)
	if(result === undefined) {
		console.log("No result. This die needs a reroll.")
	}

	if(die.d10Instance || die.dieParent) {
		// if one of the pair is asleep and the other isn't then it falls through without getting the roll result
		// otherwise both dice in the d100 are asleep and ready to calc their roll result
		if(die?.d10Instance?.asleep || die?.dieParent?.asleep) {
			const d100 = die.config.sides === 100 ? die : die.dieParent
			const d10 = die.config.sides === 10 ? die : die.d10Instance
			if (d10.result === 0 && d100.result === 0) {
				d100.result = 100; // 00 + 0 is 100 on a d100
			} else {
				d100.result = d100.result + d10.result
			}

			self.postMessage({action:"roll-result", die: {
				groupId: d100.config.groupId,
				rollId: d100.config.rollId,
				id: d100.id,
				result : d100.result
			}})
		}
	} else {
		// turn 0's on a d10 into a 10
		if(die.config.sides === 10 && die.result === 0) {
			die.result = 10
		}
		self.postMessage({action:"roll-result", die: {
			groupId: die.config.groupId,
			rollId: die.config.rollId,
			id: die.id,
			result: die.result
		}})
	}
	// add to the sleeper count
	sleeperCount++
}

const resize = (data) => {
	canvas.width = data.width
	canvas.height = data.height
	// redraw the dicebox
	diceBox.create({aspect: data.width / data.height})
	engine.resize()
}