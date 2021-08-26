import { lerp } from '../helpers'
import * as AmmoJS from "ammo.js/builds/ammo.wasm.js"

const ammoWASM = {
  locateFile: () => '../assets/ammo/ammo.wasm.wasm'
}

// Firefox limitation: https://github.com/vitejs/vite/issues/4586

// there's probably a better place for these variables
let bodies = []
let sleepingBodies = []
let colliders = {}
let physicsWorld
let Ammo
let worldWorkerPort
let tmpBtTrans
let sharedVector3
let width = 150
let height = 150
let aspect = 1
let stopLoop = false
let zoom = [43,37,32,26.5,23,20.5,18,15.75]

const defaultOptions = {
	zoomLevel: 3,
	startingHeight: 12,
	spinForce: 30,
	throwForce: 2,
	gravity: 4,
	friction: .8,
	settleTimeout: 5000,
	// runTime: 15000, // TODO: force dice to sleep after specific time
	// TODO: toss: "center", "edge", "allEdges"
}

let config = {...defaultOptions}

self.onmessage = (e) => {
  switch (e.data.action) {
    case "rollDie":
      rollDie(e.data.sides)
      break;
    case "init":
      init(e.data).then(()=>{
        self.postMessage({
          action:"init-complete"
        })
      })
      break
    case "clearDice":
			clearDice(e.data)
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
    case "connect":
      worldWorkerPort = e.ports[0]
      worldWorkerPort.onmessage = (e) => {
        switch (e.data.action) {
          case "addDie":
						// toss from all edges
						// setStartPosition()
            addDie(e.data.sides, e.data.id)
            break;
          case "rollDie":
						// TODO: this won't work, need a die object
            rollDie(e.data.id)
            break;
          case "stopSimulation":
            stopLoop = true
						
            break;
          case "resumeSimulation":
						setStartPosition()
            stopLoop = false
						loop()
            break;
          default:
            console.error("action not found in physics worker from worldOffscreen worker:", e.data.action)
        }
      }
      break
    default:
      console.error("action not found in physics worker:", e.data.action)
  }
}

// runs when the worker loads to set up the Ammo physics world and load our colliders
// loaded colliders will be cached and added to the world in a later post message
const init = async (data) => {
		width = data.width
		height = data.height
		aspect = width / height
		config = {...config,...data.options}

		Ammo = await new AmmoJS(ammoWASM)

		tmpBtTrans = new Ammo.btTransform()
		sharedVector3 = new Ammo.btVector3(0, 0, 0)

		setStartPosition(aspect)
		
		// load our collider data
		// perhaps we don't await this, let it run and resolve it later
		const modelData = await fetch('../assets/models/diceColliders.json').then(resp => {
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
		.then(data => {
			return data.meshes
		})
		.catch(error => {
			console.error(error)
			return error
		})
		
		physicsWorld = setupPhysicsWorld()

		// turn our model data into convex hull items for the physics world
		modelData.forEach((model,i) => {
			model.convexHull = createConvexHull(model)
			// model.physicsBody = createRigidBody(model.convexHull, {mass: model.mass})

			colliders[model.id] = model
		})

		const box = addBoxToWorld(zoom[config.zoomLevel])

		// loop()

}

const setVector3 = (x,y,z) => {
	sharedVector3.setValue(x,y,z)
	return sharedVector3
}

const setStartPosition = () => {
	let size = zoom[config.zoomLevel]
	// let envelopeSize = size * .6 / 2
	let edgeOffset = 2
	let xMin = size * aspect / 2 - edgeOffset
	let xMax = size * aspect / -2 + edgeOffset
	let yMin = size / 2 - edgeOffset
	let yMax = size / -2 + edgeOffset
	// let xEnvelope = lerp(envelopeSize * aspect - edgeOffset * aspect, -envelopeSize * aspect + edgeOffset * aspect, Math.random())
	let xEnvelope = lerp(xMin, xMax, Math.random())
	let yEnvelope = lerp(yMin, yMax, Math.random())
	let tossFromTop = Math.round(Math.random())
	let tossFromLeft = Math.round(Math.random())
	let tossX = Math.round(Math.random())
	// console.log(`throw coming from`, tossX ? tossFromTop ? "top" : "bottom" : tossFromLeft ? "left" : "right")

	// forces = {
	// 	xMinForce: tossX ? -config.throwForce * aspect : tossFromLeft ? config.throwForce * aspect * .3 : -config.throwForce * aspect * .3,
	// 	xMaxForce: tossX ? config.throwForce * aspect : tossFromLeft ? config.throwForce * aspect * 1 : -config.throwForce * aspect * 1,
	// 	zMinForce: tossX ? tossFromTop ? config.throwForce * .3 : -config.throwForce * .3 : -config.throwForce,
	// 	zMaxForce: tossX ? tossFromTop ? config.throwForce * 1 : -config.throwForce * 1 : config.throwForce,
	// }

	config.startPosition = [
		// tossing on x axis then z should be locked to top or bottom
		// not tossing on x axis then x should be locked to the left or right
		tossX ? xEnvelope : tossFromLeft ? xMax : xMin,
		config.startingHeight > zoom[config.zoomLevel] ? zoom[config.zoomLevel] : config.startingHeight, // start height can't be over size height
		tossX ? tossFromTop ? yMax : yMin : yEnvelope
	]

	// console.log(`startPosition`, config.startPosition)
}

const createConvexHull = (mesh) => {
	const convexMesh = new Ammo.btConvexHullShape()

	let count = mesh.positions.length

	for (let i = 0; i < count; i+=3) {
		let v = setVector3(mesh.positions[i], mesh.positions[i+1], mesh.positions[i+2])
		convexMesh.addPoint(v, true)
	}

	convexMesh.setLocalScaling(setVector3(-mesh.scaling[0],mesh.scaling[1],-mesh.scaling[2]))

	return convexMesh
}

const createRigidBody = (collisionShape, params) => {
	// apply params
	const {
		mass = 10,
		collisionFlags = 0,
		// pos = { x: 0, y: 0, z: 0 },
		// quat = { x: 0, y: 0, z: 0, w: 1 }
		pos = [0,0,0],
		// quat = [0,0,0,-1],
		quat = [
			lerp(-1.5, 1.5, Math.random()),
			lerp(-1.5, 1.5, Math.random()),
			lerp(-1.5, 1.5, Math.random()),
			-1
		],
		scale = [1,1,1],
		friction = config.friction,
		restitution = 0
	} = params

	// apply position and rotation
	const transform = new Ammo.btTransform()
	// console.log(`collisionShape scaling `, collisionShape.getLocalScaling().x(),collisionShape.getLocalScaling().y(),collisionShape.getLocalScaling().z())
	transform.setIdentity()
	transform.setOrigin(setVector3(pos[0], pos[1], pos[2]))
	transform.setRotation(
		new Ammo.btQuaternion(quat[0], quat[1], quat[2], quat[3])
	)
	// collisionShape.setLocalScaling(new Ammo.btVector3(1.1, -1.1, 1.1))
	// transform.ScalingToRef()

	// create the rigid body
	const motionState = new Ammo.btDefaultMotionState(transform)
	const localInertia = setVector3(0, 0, 0)
	if (mass > 0) collisionShape.calculateLocalInertia(mass, localInertia)
	const rbInfo = new Ammo.btRigidBodyConstructionInfo(
		mass,
		motionState,
		collisionShape,
		localInertia
	)
	const rigidBody = new Ammo.btRigidBody(rbInfo)
	
	// rigid body properties
	if (mass > 0) rigidBody.setActivationState(4) // Disable deactivation
	rigidBody.setCollisionFlags(collisionFlags)
	rigidBody.setFriction(friction)
	rigidBody.setRestitution(restitution)
	rigidBody.setDamping(.5, .4)

	// ad rigid body to physics world
	// physicsWorld.addRigidBody(rigidBody)

	return rigidBody

}
// cache for box parts so it can be removed after a new one has been made
let boxParts = []
const addBoxToWorld = (size) => {
	const tempParts = []
	// ground
	const localInertia = setVector3(0, 0, 0);
	const groundTransform = new Ammo.btTransform()
	groundTransform.setIdentity()
	groundTransform.setOrigin(setVector3(0, -.5, 0))
	const groundShape = new Ammo.btBoxShape(setVector3(size * aspect, 1, size))
	const groundMotionState = new Ammo.btDefaultMotionState(groundTransform)
	const groundInfo = new Ammo.btRigidBodyConstructionInfo(0, groundMotionState, groundShape, localInertia)
	const groundBody = new Ammo.btRigidBody(groundInfo)
	groundBody.setFriction(config.friction)
	groundBody.setRestitution(0)
	physicsWorld.addRigidBody(groundBody)
	tempParts.push(groundBody)

	const wallTopTransform = new Ammo.btTransform()
	wallTopTransform.setIdentity()
	wallTopTransform.setOrigin(setVector3(0, 0, size/-2))
	const wallTopShape = new Ammo.btBoxShape(setVector3(size * aspect, size, 1))
	const topMotionState = new Ammo.btDefaultMotionState(wallTopTransform)
	const topInfo = new Ammo.btRigidBodyConstructionInfo(0, topMotionState, wallTopShape, localInertia)
	const topBody = new Ammo.btRigidBody(topInfo)
	topBody.setFriction(config.friction)
	topBody.setRestitution(.6)
	physicsWorld.addRigidBody(topBody)
	tempParts.push(topBody)

	const wallBottomTransform = new Ammo.btTransform()
	wallBottomTransform.setIdentity()
	wallBottomTransform.setOrigin(setVector3(0, 0, size/2))
	const wallBottomShape = new Ammo.btBoxShape(setVector3(size * aspect, size, 1))
	const bottomMotionState = new Ammo.btDefaultMotionState(wallBottomTransform)
	const bottomInfo = new Ammo.btRigidBodyConstructionInfo(0, bottomMotionState, wallBottomShape, localInertia)
	const bottomBody = new Ammo.btRigidBody(bottomInfo)
	bottomBody.setFriction(config.friction)
	bottomBody.setRestitution(.6)
	physicsWorld.addRigidBody(bottomBody)
	tempParts.push(bottomBody)

	const wallRightTransform = new Ammo.btTransform()
	wallRightTransform.setIdentity()
	wallRightTransform.setOrigin(setVector3(size * aspect / -2, 0, 0))
	const wallRightShape = new Ammo.btBoxShape(setVector3(1, size, size))
	const rightMotionState = new Ammo.btDefaultMotionState(wallRightTransform)
	const rightInfo = new Ammo.btRigidBodyConstructionInfo(0, rightMotionState, wallRightShape, localInertia)
	const rightBody = new Ammo.btRigidBody(rightInfo)
	rightBody.setFriction(config.friction)
	rightBody.setRestitution(.6)
	physicsWorld.addRigidBody(rightBody)
	tempParts.push(rightBody)

	const wallLeftTransform = new Ammo.btTransform()
	wallLeftTransform.setIdentity()
	wallLeftTransform.setOrigin(setVector3(size * aspect / 2, 0, 0))
	const wallLeftShape = new Ammo.btBoxShape(setVector3(1, size, size))
	const leftMotionState = new Ammo.btDefaultMotionState(wallLeftTransform)
	const leftInfo = new Ammo.btRigidBodyConstructionInfo(0, leftMotionState, wallLeftShape, localInertia)
	const leftBody = new Ammo.btRigidBody(leftInfo)
	leftBody.setFriction(config.friction)
	leftBody.setRestitution(.6)
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

const addDie = (sides, id) => {
	let cType = `c${sides}`
	cType = cType.replace('100','10')
	// clone the collider
	const newDie = createRigidBody(colliders[cType].convexHull, {
		mass: colliders[cType].physicsMass,
		scaling: colliders[cType].scaling,
		pos: config.startPosition,
		// quat: colliders[cType].rotationQuaternion,
	})
	newDie.id = id
	newDie.timeout = config.settleTimeout
	physicsWorld.addRigidBody(newDie)
	bodies.push(newDie)
	// console.log(`added collider for `, type)
	rollDie(newDie)
}

const rollDie = (die) => {
	const force = new Ammo.btVector3(
		lerp(-config.spinForce, config.spinForce, Math.random()),
		lerp(-config.spinForce, config.spinForce, Math.random()),
		lerp(-config.spinForce, config.spinForce, Math.random())
	)
	
	die.applyImpulse(force, setVector3(4,4,4))

	die.setLinearVelocity(setVector3(
		lerp(-config.startPosition[0] * .5, -config.startPosition[0] * config.throwForce, Math.random()),
		// lerp(-config.startPosition[1] * .5, -config.startPosition[1] * config.throwForce, Math.random()),
		lerp(-config.startPosition[1], -config.startPosition[1] * 2, Math.random()),
		lerp(-config.startPosition[2] * .5, -config.startPosition[2] * config.throwForce, Math.random()),
	))
}

const removeDie = (data) => {
	sleepingBodies = sleepingBodies.filter((die) => {
		let match = die.id === data.id
		if(match){
			// remove the mesh from the scene
			physicsWorld.removeRigidBody(die)
		}
		return !match
	})

	// step the animation forward
	// requestAnimationFrame(loop)
}

const clearDice = () => {
	stopLoop = true
	// clear all bodies
	bodies.forEach(body => physicsWorld.removeRigidBody(body))
	sleepingBodies.forEach(body => physicsWorld.removeRigidBody(body))
	// clear cache arrays
	bodies = []
	sleepingBodies = []
}


const setupPhysicsWorld = () => {
	const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration()
	const broadphase = new Ammo.btDbvtBroadphase()
	const solver = new Ammo.btSequentialImpulseConstraintSolver()
	const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration)
	const World = new Ammo.btDiscreteDynamicsWorld(
		dispatcher,
		broadphase,
		solver,
		collisionConfiguration
	)
	World.setGravity(setVector3(0, -9.81 * config.gravity, 0))

	return World
}

const update = (delta) => {
	let movements = []
	let asleep = []
	const emptyVector = setVector3(0,0,0)

	// step world
	const deltaTime = delta / 1000
	physicsWorld.stepSimulation(deltaTime, 1, 1 / 60) // higher number = slow motion

	for (let i = 0, len = bodies.length; i < len; i++) {
		const rb = bodies[i]
		const speed = rb.getLinearVelocity().length()
		const tilt = rb.getAngularVelocity().length()

		if(speed < .01 && tilt < .01 || rb.timeout < 0) {
			rb.asleep = true
			rb.setMassProps(0)
			rb.forceActivationState(3)
			// zero out anything left
			rb.setLinearVelocity(emptyVector)
			rb.setAngularVelocity(emptyVector)
			asleep.push(i)
			continue
		}
		rb.timeout -= delta
		const ms = rb.getMotionState()
		if (ms) {
			ms.getWorldTransform(tmpBtTrans)
			let p = tmpBtTrans.getOrigin()
			let q = tmpBtTrans.getRotation()
			movements.push([
				parseFloat(p.x().toFixed(4)),
				parseFloat(p.y().toFixed(4)),
				parseFloat(p.z().toFixed(4)),
				parseFloat(q.x().toFixed(4)),
				parseFloat(q.y().toFixed(4)),
				parseFloat(q.z().toFixed(4)),
				parseFloat(q.w().toFixed(4)),
				rb.id
			])
		}
	}

	// this must be a reverse loop so it does not alter the array index numbers
	for (let i = asleep.length - 1; i >= 0; i--) {
		sleepingBodies.push(bodies.splice(asleep[i],1)[0])
	}

	return {movements, asleep}
}

let last = new Date().getTime()
const loop = () => {
	let now = new Date().getTime()
	const delta = now - last
	last = now

	const updates = update(delta)
	worldWorkerPort.postMessage({ action: 'updates', updates })

	if(!stopLoop) {
		// requestAnimationFrame(loop)
		// using timeout instead for browser compatability
		setTimeout(loop,4)
	}
}
