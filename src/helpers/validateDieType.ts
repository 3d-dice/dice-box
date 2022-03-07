import { dieTypes } from "../types"

export const validateDieType = ( die: string ): dieTypes => {
  const validDice: dieTypes[] = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"]

  //@ts-expect-error Argument of type 'string' is not assignable to parameter of type 'dieTypes'
  if ( validDice.includes( die ) ) {
    return die as dieTypes
  } else {
    throw new Error("Die does not match")
  }
  
}

export default validateDieType