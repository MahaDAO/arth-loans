export const NumberInputRegex = /^\d+(\.\d+)?$/;
export const mediatoryRegex = /^[0]+\d+(\.\d+)?$/;

export const ValidateNumber = (val: string) => {
  return NumberInputRegex.test(val)
}

export const initZeroCheck = (val: string) => {
  return mediatoryRegex.test(val)
}

export const removeLeadZeros = (val: string) => {
  while (val.charAt(0) === '0') val = val.slice(1);
  return val
}

export const correctString = (val: string) => {
  if (initZeroCheck(val)) return removeLeadZeros(val)
  return val
}
