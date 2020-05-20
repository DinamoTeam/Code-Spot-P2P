import { CRDT, Identifier } from './CRDT';

export class CustomNumber {

  // Don't use BASE too large (less than 2^50).
  // Reason: Number.MAX_SAFE_INTEGER = 2^53 - 1. This class will have some adding. I don't want overflow
  static readonly BASE = 10;   // 'constant'
  arr: number[];

  constructor(list: number[]) {
    this.arr = Object.assign([], list); // Deep copy
  }

  // Normal subtract function in base BASE with the assumption that n1 >= n2
  static subtractGreaterThan(n1: CustomNumber, n2: CustomNumber): CustomNumber {
    let carry = 0;
    let resArr = new Array<number>(n1.arr.length);

    let index1 = n1.arr.length - 1;
    let index2 = n2.arr.length - 1;

    if (index2 > index1) {
      throw new Error('n1 cannot not be smaller than n2');
    }

    while (index2 >= 0) {
      let curDigit = n1.arr[index1] - n2.arr[index2] - carry;
      carry = 0;
      if (curDigit < 0) {
        carry = 1;
        curDigit += this.BASE;
      }
      resArr[index1] = curDigit;
      index1--;
      index2--;
    }

    while (index1 >= 0) {
      let curDigit = n1.arr[index1] - carry;
      carry = 0;
      if (curDigit < 0) {
        carry = 1;
        curDigit += this.BASE;
      }
      resArr[index1] = curDigit;
      index1--;
    }

    let numLeadingZeros = 0;
    for (let i = 0; i < resArr.length; i++) {
      if (resArr[i] != 0) {
        break;
      }
      numLeadingZeros++;
    }

    if (resArr[0] == 0) {
      resArr.splice(0, numLeadingZeros);  // Remove leading zeros
    }

    return new CustomNumber(resArr);
  }

  // Nomal add function in base BASE
  static add(n1: CustomNumber, n2: CustomNumber): CustomNumber {
    let length1 = n1.arr.length;
    let length2 = n2.arr.length;
    let biggerLength = Math.max(length1, length2);
    let resArr = new Array<number>(biggerLength + 1);

    let carry = 0;
    let index1 = length1 - 1;
    let index2 = length2 - 1;
    let resIndex = resArr.length - 1;

    while (index1 >= 0 && index2 >= 0) {
      let sum = n1.arr[index1] + n2.arr[index2] + carry;
      carry = Math.floor(sum / this.BASE);
      let realDigit = sum % this.BASE;
      resArr[resIndex] = realDigit;
      index1--;
      index2--;
      resIndex--;
    }

    // At most 1 while loop will be executed
    while (index1 >= 0) {
      let sum = n1.arr[index1] + carry;
      carry = Math.floor(sum / this.BASE);
      let realDigit = sum % this.BASE;
      resArr[resIndex] = realDigit;
      index1--;
      resIndex--;
    }

    while (index2 >= 0) {
      let sum = n2.arr[index2] + carry;
      carry = Math.floor(sum / this.BASE);
      let realDigit = sum % this.BASE;
      resArr[resIndex] = realDigit;
      index2--;
      resIndex--;
    }

    resArr[0] = carry;

    let numLeadingZeros = 0;
    for (let i = 0; i < resArr.length; i++) {
      if (resArr[i] != 0) {
        break;
      }
      numLeadingZeros++;
    }
    if (resArr[0] == 0) {
      resArr.splice(0, numLeadingZeros); // Remove leading zeros
    }

    return new CustomNumber(resArr);
  }

  // Return a CustomNumber object from an IdentifierArray
  static customNumberFromIdentifierArray(identifiers: Identifier[]): CustomNumber {
    let digitArr = identifiers.map(id => id.digit);
    return new CustomNumber(digitArr);
  }

  toString(): string {
    let description = '';
    for (let i = 0; i < this.arr.length; i++) {
      description = description + this.arr[i];
    }
    return description;
  }
}
