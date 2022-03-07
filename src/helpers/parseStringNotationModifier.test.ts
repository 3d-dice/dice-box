import parseStringNotationModifier from "./parseStringNotationModifier"

describe("when parseStringNotationModifier is passed a valid modifer notation", () => {
  it("then returns the number", () => {
    const result = parseStringNotationModifier("+1")
    expect(result).toEqual(1)
  })

  it("then returns the number", () => {
    const result = parseStringNotationModifier("-1")
    expect(result).toEqual(-1)
  })
})

describe("when parseStringNotationModifier is passed a notation with an invalid number", () => {
  it("then throws an error", () => {
    expect(() => {
      parseStringNotationModifier("+x")
    }).toThrow()
  })
})

describe("when parseStringNotationModifier is passed an invalid symbol", () => {
  it("then throws an error", () => {
    expect(() => {
      parseStringNotationModifier("*9")
    }).toThrow()
  })
})
