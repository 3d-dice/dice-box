//Typescript can error when index by a key: object[string]
//This function allows you to type the keys
//Typically you will turn keys into strings
export const typeKeys = <T>(o: T): (keyof T)[] => {
  return Object.keys(o) as (keyof T)[];
}

type objectType = {
  [ key: string | number ]: any
}

export const findObjectByKey = (array: objectType, id: string | number) => {
  let object

  typeKeys(array).forEach(key => {
    if ( key === id ) {
      object = array[id]
    }
  });

  return object
}

export default findObjectByKey