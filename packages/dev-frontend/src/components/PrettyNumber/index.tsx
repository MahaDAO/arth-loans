// @ts-nocheck
import * as _ from 'underscore';

const suffixes: any = {
  '3': 'K',
  '12': 'TN',
  '6': 'MN',
  '9': 'BN',
};

const millify = (
  uglyNumber: number | string,
  decimalPoints: number,
): string => {
  // Make sure value is a number
  const ugly = (num => {
    if (typeof num !== 'number') {
      throw new Error('Input value is not a number');
    } else {
      return parseFloat(String(num));
    }
  })(uglyNumber);

  // Figure out how many digits in the integer
  const digits = Math.floor(Math.log10(Math.abs(ugly))) + 1;

  // Figure out the appropriate unit for the number
  const units = ((num, zeroes) => {
    let zeroes2 = zeroes;
    const keys = _.keys(suffixes);
    for (const z of keys) {
      if (num > Number(z)) {
        zeroes2 = Number(z);
      }
    }
    return { suffix: suffixes[String(zeroes2)], zeroes: zeroes2 };

  })(digits, 2);

  const pretty = ugly / Math.pow(10, units.zeroes);

  const decimal = pretty % 1 === 0 ? 2 : Math.max(1, decimalPoints + 1) || 3;

  if (ugly > -1000 && ugly < 1000) {
    return String(ugly);
  }
  return `${parseFloat(pretty.toPrecision(decimal))}${units.suffix}`;
};

export default function prettyNumber(_num: number | string) {
  const num = Number(_num);

  if (Math.abs(num) >= 10000) return millify(num, 2);
  if (Math.abs(num) >= 1000) return millify(num, 2);

  // if (Math.abs(num) >= 100) {
  //   return num.toFixed(2);
  // }
  // if (Math.abs(num) >= 1) {
  //   return num.toFixed(3);
  // }
  // if (Math.abs(num) >= 0.1) {
  //   return num.toFixed(4);
  // }

  return Math.floor(num);
}