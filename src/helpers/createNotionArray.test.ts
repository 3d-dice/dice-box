import { verifyObject, createNotationArray } from "./createNotationArray"
import { rollsMock, rollDataMock, d6RollsMock } from "../mocks"

describe("When verifyObject is passed a roll object", () =>{
  it('then verifies the object has sides and qty keys', () => {
    const result = verifyObject({ ...rollsMock[0], qty: 1 })
    expect ( result ).toBeTruthy
  })

  it('then throws an error if qty is missing', () => {
    const objectUndefinedQty = { ...rollsMock[0] }
    //@ts-expect-error intentional error for testing
    expect(() => {  verifyObject( objectUndefinedQty ) }).toThrow(Error);
  })

  it('then throws an error if sides is missing', () => {
    const objectUndefindeSides = { ...rollsMock[0], sides: undefined, qty: 1 }

    //@ts-expect-error intentional error for testing
    expect(() => {  verifyObject( objectUndefindeSides ) }).toThrow(Error);
  })
})

describe("Given createNotationArray is called", () => {
  const expectedStringReturns = [
    { qty: 1, sides: 20, modifier: 1, id: undefined, rollId: undefined, },
    { qty: 2, sides: 6, modifier: 10, id: undefined, rollId: undefined, },
  ]

  const expectedRollObjectsReturn = [
    { qty: 1, sides: 20, }
  ]

  describe("when passed a string", () => {
    it("then returns parsed string notation", () => {
      const result = createNotationArray("1d20+1")
      expect(result).toEqual( [ expectedStringReturns[0] ])
    })

    it("then returns parsed string notation", () => {
      expect(() => { createNotationArray("1x20+1") }).toThrow(Error)
    })
  })

  describe("when passed an array of strings", () => {
    it("then returns parsed string notations", () =>{
      const result = createNotationArray( ["1d20+1", "2d6+10"] )
      expect(result).toEqual( expectedStringReturns )
    })
  })

  describe("when passed an object with qty and sides", () => {
    const validObject = rollDataMock[1]
    it("then returns an array with that object", () => {
      const result = createNotationArray( validObject )
      expect(result).toEqual( [ validObject ] )
    })

    const invalidObject = {...rollDataMock[1], qty: undefined }
    it("then throws an error when object is invalid", () => {
      expect(() => {
        //@ts-expect-error intentionally incorrect object
        createNotationArray( invalidObject )
      }).toThrow(Error)
    })
  })

  describe("when passed an array of objects each with qty & sides", () => {
    it("then returns an array with those objects", () => {
      const result = createNotationArray( rollDataMock )
      expect(result).toEqual( rollDataMock )
    })

    const invalidObject = [{...rollDataMock[1], qty: undefined }]
    it("then throws an error when object is invalid", () => {
      expect(() => {
        //@ts-expect-error intentionally incorrect object
        createNotationArray( invalidObject )
      }).toThrow(Error)
    })
  })
})
