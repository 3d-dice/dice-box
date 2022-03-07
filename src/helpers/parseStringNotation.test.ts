import  parseStringNotation  from "./parseStringNotation"

const validMock = {
  qty: 1,
  sides: 20,
  modifier: 1,
  id: undefined,
  rollId: undefined,
}

describe("when parseStringNotation is given a valid die roll string",() => {
  it("then returns an object from the parsed text", () => {
    const result = parseStringNotation("1d20+1")
    expect(result).toEqual(validMock)
  })

  it("then throws an error if the roll notation does not match the digit, d, digit, digit* format ", () => {
    expect(() => {
      parseStringNotation("1dx3")
    }).toThrow()
  })
})