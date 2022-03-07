import validateInteger from "./validateInteger"
import parseStringNotationModifier from "./parseStringNotationModifier"

// parse text die notation such as 2d10+3 => {number:2, type:6, modifier:3}
// taken from https://github.com/ChapelR/dice-notation
const parseStringNotation = ( notation: string ) => {
    const cleanNotation = notation.trim().replace(/\s+/g, '')
    const diceNotation = /(\d+)[dD](\d+)(.*)$/i
    const msg = `Invalid notation: ${notation}`
    const roll = cleanNotation.match( diceNotation )

    if ( !roll ) {
      throw new Error(`${msg}. Examples: 1d6, 2d20, 3d10+5`)
    }
    
    const modifier = roll[3] ? parseStringNotationModifier(roll[3]) : 0
    const qty = validateInteger(roll[1], msg)
    const sides = validateInteger(roll[2], msg)

    return {
      qty,
      sides,
      modifier,
      id: undefined,
      rollId: undefined,
    }
  }

export default parseStringNotation
