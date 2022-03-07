	import { inputTypes, parsedNotationType, parsedStringType, rerollType } from "../types"
	import parseStringNotation from "./parseStringNotation"

	export const verifyObject = ( formula: parsedStringType | rerollType) => {
		const checkSidesAndQty =  formula.sides && formula.qty ? true : false

		if ( checkSidesAndQty ) {
			return true
		} else {
			const err = "Roll notation is missing sides and/or qty"
			throw new Error(err);
		}
	}

  // accepts simple notations eg: 4d6
	// accepts array of notations eg: ['4d6','2d10']
	// accepts array of objects eg: [{ sides:int, qty:int }]
	// accepts object { sides:int, qty:int }
	export const createNotationArray = ( input: inputTypes ) => {
		const notation = Array.isArray( input ) ? input : [ input ]
		let parsedNotation: parsedNotationType[] = []

		// notation is an array of strings or objects
		notation.forEach(roll => {
			// if notation is an array of strings
			if ( typeof roll === 'string' ) {
				parsedNotation.push( parseStringNotation( roll ) )
			} else if ( typeof notation === 'object' ) {
				verifyObject( roll ) && parsedNotation.push( roll )
			}
		})

		return parsedNotation
	}

  export default createNotationArray
	