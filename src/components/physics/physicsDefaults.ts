export const diceDefaults = {
	c4: {
		mass: .7,
		scaling: [1,1,-1]
	},
	c6: {
		mass: .8,
		scaling: [1,1,-1]
	},
	c8: {
		mass: .82,
		scaling: [1,1,-1]
	},
	c10: {
		mass: .85,
		scaling: [1,1,-1]
	},
	c12: {
		mass: .9,
		scaling: [1,1,-1]
	},
	c20: {
		mass: 1,
		scaling: [1,1,-1]
	}
}

export const defaultOptions = {
	angularDamping: .4,
	friction: .8,
	gravity: 4,
	linearDamping: .5,
	mass: 3,
	restitution: 0,
	settleTimeout: 5000,
	spinForce: 6,
	startingHeight: 12,
	throwForce: 2,
	zoomLevel: 3,
}

export const colliderDefault = {
	billboardMode: 0,
	convexHull: {
		Wh: 0
	},
	indices: [],
	instances: [],
	isEnabled: false,
	isVisible: false,
	normals: [],
	physicsFriction: 0,
	physicsMass: 0,
	physicsRestitution: 0,
	pickable: false,
	position: [],
	positions: [],
	rotationQuaternion: [],
	scaling: [],
	subMeshes: [],
	uvs: []
}