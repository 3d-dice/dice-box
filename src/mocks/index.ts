export const rollsMock = [
  {
    groupId: 0,
    id: 0,
    result: 15,
    rollId: 0,
    sides: 20,
    theme: 'purpleRock',
  },
  {
    groupId: 0,
    id: 1,
    result: 10,
    rollId: 1,
    sides: 20,
    theme: 'purpleRock',
  }
]

export const d6RollsMock = [
  {
    groupId: 0,
    id: 0,
    result: 4,
    rollId: 0,
    sides: 6,
    theme: "purpleRock",
  },
  {
    groupId: 0,
    id: 1,
    result: 2,
    rollId: 1,
    sides: 6,
    theme: "purpleRock",
  } 
]

export const rollDataMock = [
  {
    id: undefined,
    modifier: 1,
    qty: 2,
    rollId: undefined,
    rolls: rollsMock,
    sides: 20,
    value: 26,
  },
  {
    id: undefined,
    modifier: 10,
    qty: 2,
    rollId: undefined,
    rolls: d6RollsMock,
    sides: 6,
    value: 15,
  },
]