import { lerp } from '../../helpers'
import AmmoJS from "../../ammo/ammo.js"
import findObjectByKey from '../../helpers/findObjectByKey'
import { diceDefaults, defaultOptions, colliderDefault } from "./physicsDefaults"
import { 
	dataType,
	eventDataType,
	meshDataType,
	meshType,
	workWorkerEventType,
	optionsType,
	physicsWorldType,
	sharedVector3Type,
	physicWokrerConfigType as configType,
	collisionShapeType,
	createRigidBodyParamsType,
	sideType,
	collidersType,
	colliderType,
	removeDieDataType,
	rollDieType,
	sleepingBodyType,
	bodyType,
	tmpBtTransType,
} from "../../types"

// Firefox limitation: https://github.com/vitejs/vite/issues/4586

// there's probably a better place for these variables
let Ammo: unknown
let aspect = 1
let bodies: bodyType[] = []
let colliders: collidersType = {
  c4: { id: 'c4', name: 'c4', ...colliderDefault },
  c6: { id: 'c6', name: 'c6', ...colliderDefault },
  c8: { id: 'c8', name: 'c8', ...colliderDefault },
  c10: { id: 'c10', name: 'c10', ...colliderDefault },
  c12: { id: 'c12', name: 'c12', ...colliderDefault },
  c20: { id: 'c20', name: 'c20', ...colliderDefault }
}
let height = 150
let physicsWorld: physicsWorldType
let sharedVector3: sharedVector3Type
let sleepingBodies: sleepingBodyType[] = []
let stopLoop = false
let tmpBtTrans: tmpBtTransType
let width = 150
let worldWorkerPort: MessagePort
let zoom = [43,37,32,26.5,23,20.5,18,15.75]

let config: configType = { 
	...defaultOptions,
	origin: '',
	assetPath: '',
	startPosition: []
}

let emptyVector: sharedVector3Type
let diceBufferView: Float32Array

self.onmessage = (e: MessageEvent<eventDataType>) => {
  switch (e.data.action) {
    case "init":
      init(e.data).then(()=>{
        self.postMessage({
          action:"init-complete"
        })
      })
      break
    case "clearDice":
			clearDice()
      break
		case "removeDie":
			removeDie(e.data)
			break;
		case "resize":
			width = e.data.width
			height = e.data.height
			aspect = width / height
			addBoxToWorld(zoom[config.zoomLevel])
			break
		case "updateConfig":
			updateConfig(e.data.options)
			break
    case "connect":
      worldWorkerPort = e.ports[0]
      worldWorkerPort.onmessage = ((e: MessageEvent<workWorkerEventType>) => {
        switch (e.data.action) {
					case "initBuffer":
						diceBufferView = new Float32Array(e.data.diceBuffer)
						diceBufferView[0] = -1
						break;
          case "addDie":
						// toss from all edges
            addDie(e.data.sides, e.data.id)
            break;
          case "stopSimulation":
            stopLoop = true
            break;
          case "resumeSimulation":
						setStartPosition()
            stopLoop = false
						loop()
            break;
					case "stepSimulation":
						diceBufferView = new Float32Array(e.data.diceBuffer)
						loop()
						break;
          default:
            console.error("action not found in physics worker from worldOffscreen worker:", e.data.action)
        }
      })
      break
    default:
      console.error("action not found in physics worker:", e.data.action)
  }
}
// runs when the worker loads to set up the Ammo physics world and load our colliders
// loaded colliders will be cached and added to the world in a later post message
const init = async ( data: dataType ) => {
	width = data.width
	height = data.height
	aspect = width / height
	config = {...config, ...data.options}

	const ammoWASM = {
		locateFile: () => `${config.origin + config.assetPath}ammo/ammo.wasm.wasm`
	}

  //TS says this await is unnecessary. It is wrong.
	Ammo = await new AmmoJS(ammoWASM)

	//@ts-expect-error Ammo not typed
	tmpBtTrans = new Ammo.btTransform()
	//@ts-expect-error Ammo not typed
	sharedVector3 = new Ammo.btVector3(0, 0, 0)
	emptyVector = setVector3(0,0,0)

	setStartPosition()
	
	// load our collider data
	// perhaps we don't await this, let it run and resolve it later
	const modelData: meshType[] = await fetch(`${config.origin + config.assetPath}models/diceColliders.json`).then(resp => {
		if(resp.ok) {
			const contentType = resp.headers.get("content-type")

			if (contentType && contentType.indexOf("application/json") !== -1) {
				return resp.json()
			} 
			else if (resp.type && resp.type === 'basic') {
				return resp.json()
			}
			else {
				return resp
			}
		} else {
			throw new Error(`Request rejected with status ${resp.status}: ${resp.statusText}`)
		}
	})
	.then(( data: meshDataType ) => {
		const meshWithScalingAndMass: meshType[] = []

		data.meshes.forEach(( mesh ) => {
			const object = findObjectByKey(diceDefaults, mesh.id)

			if (object) {
				const { mass, scaling } = object
					
				meshWithScalingAndMass.push({
					...mesh,
					scaling,
					physicsMass: mass,
				})
			}
		})

		return meshWithScalingAndMass
	})
	.catch(error => {
		console.error(error)
		return error
	})
	
	physicsWorld = setupPhysicsWorld()

	// turn our model data into convex hull items for the physics world
	modelData.forEach((model: meshType ) => {
		model.convexHull = createConvexHull(model)
		colliders[model.id] = model
	})

	addBoxToWorld(zoom[config.zoomLevel])
}

const updateConfig = (options: optionsType) => {
	config = {...config, ...options}
	removeBoxFromWorld()
	addBoxToWorld(zoom[config.zoomLevel])
	physicsWorld.setGravity( setVector3(0, -9.81 * config.gravity, 0) )
}

const setVector3 = (x: number,y: number,z: number) => {
	sharedVector3.setValue(x,y,z)
	return sharedVector3
}

const setStartPosition = () => {
	let size = zoom[config.zoomLevel]
	let edgeOffset = 2
	let xMin = size * aspect / 2 - edgeOffset
	let xMax = size * aspect / -2 + edgeOffset
	let yMin = size / 2 - edgeOffset
	let yMax = size / -2 + edgeOffset
	let xEnvelope = lerp(xMin, xMax, Math.random())
	let yEnvelope = lerp(yMin, yMax, Math.random())
	let tossFromTop = Math.round(Math.random())
	let tossFromLeft = Math.round(Math.random())
	let tossX = Math.round(Math.random())

	config.startPosition = [
		// tossing on x axis then z should be locked to top or bottom
		// not tossing on x axis then x should be locked to the left or right
		tossX ? xEnvelope : tossFromLeft ? xMax : xMin,
		config.startingHeight > zoom[config.zoomLevel] ? zoom[config.zoomLevel] : config.startingHeight, // start height can't be over size height
		tossX ? tossFromTop ? yMax : yMin : yEnvelope
	]
}

const createConvexHull = (mesh: meshType) => {
	//@ts-expect-error Ammo not typed
	const convexMesh = new Ammo.btConvexHullShape()

	let count = mesh.positions.length

	for (let i = 0; i < count; i+=3) {
		let v = setVector3(mesh.positions[i], mesh.positions[i+1], mesh.positions[i+2])
		convexMesh.addPoint(v, true)
	}

	convexMesh.setLocalScaling(setVector3(-mesh.scaling[0],mesh.scaling[1],-mesh.scaling[2]))

	return convexMesh
}

const createRigidBody = ( 
	collisionShape: collisionShapeType, 
	params: createRigidBodyParamsType 
) => {
	// apply params
	const {
		mass = 10,
		collisionFlags = 0,
		pos = [0,0,0],
		quat = [
			lerp(-1.5, 1.5, Math.random()),
			lerp(-1.5, 1.5, Math.random()),
			lerp(-1.5, 1.5, Math.random()),
			-1
		],
		scale = [1,1,1],
		friction = config.friction,
		restitution = config.restitution
	} = params

	// apply position and rotation
	//@ts-expect-error Ammo not typed
	const transform = new Ammo.btTransform()
	transform.setIdentity()
	transform.setOrigin(setVector3(pos[0], pos[1], pos[2]))
	transform.setRotation(
		//@ts-expect-error Ammo not typed
		new Ammo.btQuaternion(quat[0], quat[1], quat[2], quat[3])
	)

	// create the rigid body
	//@ts-expect-error Ammo not typed
	const motionState = new Ammo.btDefaultMotionState(transform)
	const localInertia = setVector3(0, 0, 0)

	if (mass > 0 && collisionShape.calculateLocalInertia) {
		collisionShape.calculateLocalInertia(mass, localInertia)
	}

	//@ts-expect-error Ammo not typed
	const rbInfo = new Ammo.btRigidBodyConstructionInfo(
		mass,
		motionState,
		collisionShape,
		localInertia
	)
	//@ts-expect-error Ammo not typed
	const rigidBody = new Ammo.btRigidBody(rbInfo)
	
	// rigid body properties
	if (mass > 0) rigidBody.setActivationState(4) // Disable deactivation
	rigidBody.setCollisionFlags(collisionFlags)
	rigidBody.setFriction(friction)
	rigidBody.setRestitution(restitution)
	rigidBody.setDamping(config.linearDamping, config.angularDamping)

	return rigidBody
}
// cache for box parts so it can be removed after a new one has been made
let boxParts: unknown[] = []
const addBoxToWorld = (size: number) => {
	const tempParts = []
	// ground
	const localInertia = setVector3(0, 0, 0);
	//@ts-expect-error Ammo not typed
	const groundTransform = new Ammo.btTransform()
	groundTransform.setIdentity()
	groundTransform.setOrigin(setVector3(0, -.5, 0))
	//@ts-expect-error Ammo not typed
	const groundShape = new Ammo.btBoxShape(setVector3(size * aspect, 1, size))
	//@ts-expect-error Ammo not typed
	const groundMotionState = new Ammo.btDefaultMotionState(groundTransform)
	//@ts-expect-error Ammo not typed
	const groundInfo = new Ammo.btRigidBodyConstructionInfo(0, groundMotionState, groundShape, localInertia)
	//@ts-expect-error Ammo not typed
	const groundBody = new Ammo.btRigidBody(groundInfo)
	groundBody.setFriction(config.friction)
	groundBody.setRestitution(config.restitution)
	physicsWorld.addRigidBody(groundBody)
	tempParts.push(groundBody)

	//@ts-expect-error Ammo not typed
	const wallTopTransform = new Ammo.btTransform()
	wallTopTransform.setIdentity()
	wallTopTransform.setOrigin(setVector3(0, 0, size/-2))
	//@ts-expect-error Ammo not typed
	const wallTopShape = new Ammo.btBoxShape(setVector3(size * aspect, size, 1))
	//@ts-expect-error Ammo not typed
	const topMotionState = new Ammo.btDefaultMotionState(wallTopTransform)
	//@ts-expect-error Ammo not typed
	const topInfo = new Ammo.btRigidBodyConstructionInfo(0, topMotionState, wallTopShape, localInertia)
	//@ts-expect-error Ammo not typed
	const topBody = new Ammo.btRigidBody(topInfo)
	topBody.setFriction(config.friction)
	topBody.setRestitution(config.restitution)
	physicsWorld.addRigidBody(topBody)
	tempParts.push(topBody)
	//@ts-expect-error Ammo not typed
	const wallBottomTransform = new Ammo.btTransform()
	wallBottomTransform.setIdentity()
	wallBottomTransform.setOrigin(setVector3(0, 0, size/2))
	//@ts-expect-error Ammo not typed
	const wallBottomShape = new Ammo.btBoxShape(setVector3(size * aspect, size, 1))
	//@ts-expect-error Ammo not typed
	const bottomMotionState = new Ammo.btDefaultMotionState(wallBottomTransform)
	//@ts-expect-error Ammo not typed
	const bottomInfo = new Ammo.btRigidBodyConstructionInfo(0, bottomMotionState, wallBottomShape, localInertia)
	//@ts-expect-error Ammo not typed
	const bottomBody = new Ammo.btRigidBody(bottomInfo)
	bottomBody.setFriction(config.friction)
	bottomBody.setRestitution(config.restitution)
	physicsWorld.addRigidBody(bottomBody)
	tempParts.push(bottomBody)
	//@ts-expect-error Ammo not typed
	const wallRightTransform = new Ammo.btTransform()
	wallRightTransform.setIdentity()
	wallRightTransform.setOrigin(setVector3(size * aspect / -2, 0, 0))
	//@ts-expect-error Ammo not typed
	const wallRightShape = new Ammo.btBoxShape(setVector3(1, size, size))
	//@ts-expect-error Ammo not typed
	const rightMotionState = new Ammo.btDefaultMotionState(wallRightTransform)
	//@ts-expect-error Ammo not typed
	const rightInfo = new Ammo.btRigidBodyConstructionInfo(0, rightMotionState, wallRightShape, localInertia)
	//@ts-expect-error Ammo not typed
	const rightBody = new Ammo.btRigidBody(rightInfo)
	rightBody.setFriction(config.friction)
	rightBody.setRestitution(config.restitution)
	physicsWorld.addRigidBody(rightBody)
	tempParts.push(rightBody)
	//@ts-expect-error Ammo not typed
	const wallLeftTransform = new Ammo.btTransform()
	wallLeftTransform.setIdentity()
	wallLeftTransform.setOrigin(setVector3(size * aspect / 2, 0, 0))
	//@ts-expect-error Ammo not typed
	const wallLeftShape = new Ammo.btBoxShape(setVector3(1, size, size))
	//@ts-expect-error Ammo not typed
	const leftMotionState = new Ammo.btDefaultMotionState(wallLeftTransform)
	//@ts-expect-error Ammo not typed
	const leftInfo = new Ammo.btRigidBodyConstructionInfo(0, leftMotionState, wallLeftShape, localInertia)
	//@ts-expect-error Ammo not typed
	const leftBody = new Ammo.btRigidBody(leftInfo)
	leftBody.setFriction(config.friction)
	leftBody.setRestitution(config.restitution)
	physicsWorld.addRigidBody(leftBody)
	tempParts.push(leftBody)

	if(boxParts.length){
		removeBoxFromWorld()
	}
	boxParts = [...tempParts]
}

const removeBoxFromWorld = () => {
	boxParts.forEach(part => physicsWorld.removeRigidBody(part))
}

const addDie = (sides: sideType, id: unknown) => {
	const cType = sides === 100 ? `c10` : `c${sides}`

	const findCollider = (): colliderType | undefined => {
		return findObjectByKey(colliders, cType)
	}

	const collider = findCollider()

	if ( collider ) {
		// clone the collider
		const newDie = createRigidBody(collider.convexHull, {
			mass: collider.physicsMass * config.mass,
			scaling: collider.scaling,
			pos: config.startPosition,
		})


		newDie.id = id
		newDie.timeout = config.settleTimeout
		physicsWorld.addRigidBody(newDie)
		bodies.push(newDie)

		rollDie(newDie)
	} else {
		throw new Error("Physics Worker: Collider was not found.")
	}
}

const rollDie = (die: rollDieType) => {
	die.setLinearVelocity(  
			setVector3(
				lerp(-config.startPosition[0] * .5, -config.startPosition[0] * config.throwForce, Math.random()),
				lerp(-config.startPosition[1], -config.startPosition[1] * 2, Math.random()),
				lerp(-config.startPosition[2] * .5, -config.startPosition[2] * config.throwForce, Math.random()),
			)
		)
	//@ts-expect-error Ammo not typed
	const force = new Ammo.btVector3(
		lerp(-config.spinForce, config.spinForce, Math.random()),
		lerp(-config.spinForce, config.spinForce, Math.random()),
		lerp(-config.spinForce, config.spinForce, Math.random())
	)
	
	die.applyImpulse(force, setVector3(4,4,4))
}

const removeDie = ( data: removeDieDataType ) => {
	sleepingBodies = sleepingBodies.filter((die) => {
		let match = die.id === data.id
		if (match){
			// remove the mesh from the scene
			physicsWorld.removeRigidBody(die)
		}
		return !match
	})
}

const clearDice = () => {
	if(diceBufferView.byteLength){
		diceBufferView.fill(0)
	}
	stopLoop = true
	// clear all bodies
	bodies.forEach(body => physicsWorld.removeRigidBody(body))
	sleepingBodies.forEach(body => physicsWorld.removeRigidBody(body))
	// clear cache arrays
	bodies = []
	sleepingBodies = []
}


const setupPhysicsWorld = () => {
	//@ts-expect-error Ammo not typed
	const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration()
	//@ts-expect-error Ammo not typed
	const broadphase = new Ammo.btDbvtBroadphase()
	//@ts-expect-error Ammo not typed
	const solver = new Ammo.btSequentialImpulseConstraintSolver()
	//@ts-expect-error Ammo not typed
	const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration)
	//@ts-expect-error Ammo not typed
	const World = new Ammo.btDiscreteDynamicsWorld(
		dispatcher,
		broadphase,
		solver,
		collisionConfiguration
	)
	World.setGravity(setVector3(0, -9.81 * config.gravity, 0))

	return World
}

const update = (delta: number) => {
	// step world
	const deltaTime = delta / 1000
	
	physicsWorld.stepSimulation(deltaTime, 2, 1 / 90) // higher number = slow motion

	diceBufferView[0] = bodies.length

	// looping backwards since bodies are removed as they are put to sleep
	for (let i = bodies.length - 1; i >= 0; i--) {
		const rb = bodies[i]
		const speed = rb.getLinearVelocity && rb.getLinearVelocity().length()
		const tilt = rb.getAngularVelocity && rb.getAngularVelocity().length()

		if ( !speed ) throw new Error("Physics Worker: Speed was not found.")
		if ( !tilt ) throw new Error("Physics Worker: Tilt was not found")

		if (speed < .01 && tilt < .01 || rb.timeout < 0) {
			// flag the second param for this body so it can be processed in World, first param will be the roll.id
			diceBufferView[(i*8) + 1] = rb.id
			diceBufferView[(i*8) + 2] = -1
			rb.asleep = true
			rb.setMassProps && rb.setMassProps(0)
			rb.forceActivationState && rb.forceActivationState(3)
			// zero out anything left
			rb.setLinearVelocity && rb.setLinearVelocity(emptyVector)
			rb.setAngularVelocity && rb.setAngularVelocity(emptyVector)
			sleepingBodies.push(bodies.splice(i,1)[0])
			continue
		}
		// tick down the movement timeout on this die
		rb.timeout -= delta
		const ms = rb.getMotionState && rb.getMotionState()
		if ( ms ) {
			ms.getWorldTransform(tmpBtTrans)
			let p = tmpBtTrans.getOrigin()
			let q = tmpBtTrans.getRotation()
			let j = i*8 + 1

			diceBufferView[j] = rb.id
			diceBufferView[j+1] = p.x()
			diceBufferView[j+2] = p.y()
			diceBufferView[j+3] = p.z()
			diceBufferView[j+4] = q.x()
			diceBufferView[j+5] = q.y()
			diceBufferView[j+6] = q.z()
			diceBufferView[j+7] = q.w()
		}
	}
}

let last = new Date().getTime()
const loop = () => {
	let now = new Date().getTime()
	const delta = now - last
	last = now

	if(!stopLoop && diceBufferView.byteLength) {
		update(delta)
			worldWorkerPort.postMessage({
				action: 'updates',
				diceBuffer: diceBufferView.buffer
			}, [diceBufferView.buffer])
	}
}
