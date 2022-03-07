import validateInteger from "./validateInteger"

export const parseStringNotationModifier = (notation: string, msg = `Invalid notation: ${notation}`) => {
  //This only allows + or -
  const modifier = /([+-])(\d+)/

  if ( !modifier.test(notation) ) {
    throw new Error(`${msg}. Modifier was invalid. Examples: 1d10+5, 2d6-1`)
  }

  const modParts = notation.match(modifier)
  if ( modParts ) {
    let basicMod = validateInteger(modParts[2], msg)

    if ( modParts[1].trim() === '-' ) {
      basicMod *= -1
    }

    return basicMod
  }

  return 0
}

export default parseStringNotationModifier