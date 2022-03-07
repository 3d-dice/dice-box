export const validateInteger = (n: string | number, err: string = "Number is invalid") => {
  const num = Number(n)
  if (Number.isNaN(num) || !Number.isInteger(num) || num < 1) {
    throw new Error(err);
  }
  return num
}

export default validateInteger