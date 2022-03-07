import validateInteger from "./validateInteger"

describe("when validateInteger is called with a number", () => {
  it("then returns a number", () => {
    const result = validateInteger(3)
    expect(result).toEqual(3)
  })
})

describe("when validateInteger is called with a string that is a number", () =>{
  it("then returns the string converted to a number", ()=>{
    const result = validateInteger("3")
    expect(result).toEqual(3)
  })
})

describe("when validateInteger receies an invalid number", () => {
  it("then throws an error when the parameter is not a number", () => {
    expect(() => validateInteger("X")).toThrow(Error)
  })

  it("then throws an error when the parameter is not an integer", () => {
    expect(() => validateInteger(1.5)).toThrow(Error)
  })  
  it("then throws an error when the number is less than one", () => {
    expect(() => validateInteger(0)).toThrow(Error)
  })

  it("then throws a custom error message when one is provided", () => {
    const msg = "I am an error"
    expect(() => validateInteger(0, msg)).toThrow(msg)
  })
})