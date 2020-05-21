import { Identifier } from './CRDT';

export class CustomNumber {

  // Don't use BASE too large (less than 2^50).
  // Reason: Number.MAX_SAFE_INTEGER = 2^53 - 1. This class will have some adding. I don't want overflow
  static readonly BASE = 10;   // 'constant'
  arr: number[];

  constructor(list: number[]) {
    this.arr = Object.assign([], CustomNumber.trimLeadingZeros(list)); // Deep copy
  }

  // Normal subtract function in base BASE with the assumption that n1 >= n2
  static subtractGreaterThan(n1: CustomNumber, n2: CustomNumber): CustomNumber {

    if (n1.compareTo(n2) < 0) {
      throw new Error('n1 < n2 in when substracting greater than');
    }

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

    resArr = CustomNumber.trimLeadingZeros(resArr);

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

    resArr = CustomNumber.trimLeadingZeros(resArr);

    return new CustomNumber(resArr);
  }

  // Return a CustomNumber object from an IdentifierArray by taking digits only
  static customNumberFromIdentifierArray(identifiers: Identifier[]): CustomNumber {
    let digitArr = identifiers.map(id => id.digit);
    return new CustomNumber(digitArr);
  }

  // Decrease some digits to generate a number less than n
  static generateLessThan(n: CustomNumber): CustomNumber {
    // If only 1 digit
    if (n.arr.length == 1) {  
      const newDigit = Math.floor(Math.random() * (n.arr[0] - 1)) + 1;  // newDigit = 1->oldDigit-1. Never 0
      return new CustomNumber([newDigit]);
    }

    // 2 digits or longer
    let newArr = Object.assign([], n.arr);
    const numDigitsNonZero = newArr.filter(x => x != 0).length;
    if (numDigitsNonZero === 1) { // Such an unusual case (Ex: 1000000)
      // Decrease that number by 1 to get more nonZeroDigits
      const newNumber = CustomNumber.subtractGreaterThan(n, new CustomNumber([1]));
      newArr = Object.assign([], newNumber.arr);
    }
    // Decrease 1->numDigitsNonZero-1 times, prioritize more significant digits
    const toBeDecreased = Math.floor(Math.random() * (numDigitsNonZero - 1)) + 1;
    for (let i = 0; i < newArr.length; i++) {
      if (newArr[i] != 0) {
        newArr[i] = Math.floor(Math.random() * newArr[i]);
      }
    }

    // Always return something > 0
    const result = new CustomNumber(CustomNumber.trimLeadingZeros(newArr));
    if (result.compareTo(new CustomNumber([0])) === 0) { // If result is 0
      return new CustomNumber([1]); // fine! return 1
    }
    return result;  // If result is not 0, return result
  }

  // Trim leading zeros, but left 1 zero if the remaining array is [0]
  static trimLeadingZeros(arr: number[]): number[] {
    const firstNonZeroIndex = arr.findIndex(x => x != 0);
    if (firstNonZeroIndex === -1) { // If the whole array is 0
      return [0];
    }
    return arr.slice(firstNonZeroIndex, arr.length);
  }

  // Normal compare in base BASE
  compareTo(other: CustomNumber): number {
    if (this.arr.length !== other.arr.length) {
      return this.arr.length - other.arr.length;  // If length's not equal, trivial. Just compare length 
    }

    for (let i = 0; i < this.arr.length; i++) {
      if (this.arr[i] != other.arr[i]) {
        return this.arr[i] - other.arr[i];
      }
    }
    return 0; // Equal
  }

  toString(): string {
    let description = '';
    let currentBase = CustomNumber.BASE;
    if (currentBase === 10) {
      for (let i = 0; i < this.arr.length; i++) {
        description = description + this.arr[i];
      }
    }
    else {
      for (let i = 0; i < this.arr.length; i++) {
        description = description + '(' + this.arr[i] + ')';
      }
    }
    return description;
  }
}
