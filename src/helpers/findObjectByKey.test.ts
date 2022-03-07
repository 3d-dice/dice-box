import findObjectByKey from "./findObjectByKey"

describe("when findObjectByKey is paseed a set of objects and an id", () => {
  const objectMock = {
    c4: {
      mass: .7,
      scaling: [1,1,-1]
    },
    c6: {
      mass: .8,
      scaling: [1,1,-1]
    },
  }

  it("then will find an object with the matching key", () => {
    const result = findObjectByKey(objectMock, "c4")
    expect( result ).toEqual( objectMock.c4 )
  })

  it("then will return undefined if the object was no there", () => {
    const result = findObjectByKey(objectMock, "c8")
    expect( result ).toEqual( undefined )
  })
})