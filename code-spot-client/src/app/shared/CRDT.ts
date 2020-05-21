// IMPORTANT: Start CRDT arr with <1, ServerID> and end with <INF, ServerID>. ServerID = 0
//                                 ^ (not 0)
// CustomNumber trim 0s at the beginning

import { CustomNumber } from './CustomNumber';

// Each CRDT object will correspond to 1 character in the text editor
// A sorted, increasing order of CRDT array will correspond to the whole text
export class CRDT {
  ch: string;
  id: CRDTId;

  constructor(character: string, id: CRDTId) {
    this.ch = character;
    this.id = id;
  }

  // Compare CRDT by its id
  compareTo(other: CRDT): number { 
    return this.id.compareTo(other.id);
  }
}

/* CRDTId is equivalent to position identifier in Logoot paper page 4 definition 1 */
export class CRDTId {
  arr: Identifier[];   /* arr is equivalent to position in Logoot paper page 4 definition 1 line 3 */
  clockValue: number;

  constructor(identifierArr: Identifier[], clock: number) {
    this.arr = identifierArr;
    this.clockValue = clock;
  }

  // Compare identifiers array from left to right. Terminate if one identifier is bigger than the other
  // If one array runs out of length, the longer is the bigger
  compareTo(other: CRDTId): number {
    let length1 = this.arr.length;
    let length2 = other.arr.length;
    let smallerLength = Math.min(length1, length2);

    // Compare corresponding identifiers inside arr
    for (let i = 0; i < smallerLength; i++) {
      if (this.arr[i].compareTo(other.arr[i]) == 0) {
        continue;   // Equal => move onto the next
      }
      else {
        return this.arr[i].compareTo(other.arr[i]); // Otherwise, the ith identifiers determine smaller/bigger
      }
    }

    // If we go to the end of one arr, it means the "beginning part" is exactly equal
    // => If equal length, compare by clockValue. Otherwise, the one longer is bigger 
    if (length1 === length2) { // This rarely, rarely happens!
      return this.clockValue - other.clockValue;
    }
    return length1 - length2;
  }

  // Generate an CRDTId in between id1 and id2
  // Rough idea:
  // delta = id2 - id1;
  // idBetween = id1 + lessThanDeltaButBiggerThan0
  static generatePositionBetween(id1: CRDTId, id2: CRDTId, siteId: number, clock: number): CRDTId {
    let index = -1;
    const shorterLength = Math.min(id1.arr.length, id2.arr.length);

    // Find the first different index
    while (index < shorterLength) {
      index++;
      if (id1.arr[index] !== id2.arr[index]) {    // First time not match
        break;
      }
    }

    index--;  // decrease to fit with the while loop below
    let delta = new CustomNumber([0]);
    // loop until delta >= 2. (Eg: 7-5=2 => There's 1 spot for 6 in the middle. 7-6=1 doesn't work)
    // Note: use prefix is enough because 2 > 1341242 (like version number) - we know it's bigger right from the first index
    while (delta.compareTo(new CustomNumber([2])) < 0) { // while delta < 2
      index++;
      const prefix1 = CRDTId.prefix(id1, index);
      const prefix2 = CRDTId.prefix(id2, index);
      delta = CustomNumber.subtractGreaterThan(prefix2, prefix1);
    }

    const smallerThanDelta = CustomNumber.generateLessThan(delta); // < delta but > 0
    const prefix1 = CRDTId.prefix(id1, index);
    const numberBetweenPrefix1AndPrefix2 = CustomNumber.add(prefix1, smallerThanDelta); // idBetween = id1 + lessThanDelta

    const newCRDTIdBetweenId1AndId2 = CRDTId.constructPosition(numberBetweenPrefix1AndPrefix2, id1, id2, siteId, clock);
    return newCRDTIdBetweenId1AndId2;
  }

  // Take elements 0 to 'index' inclusive (digit only) and map to a number array.
  // Add 0 to the back if arr.length < num, and then convert to a CustomNumber
  static prefix(id: CRDTId, index: number): CustomNumber {
    const num = index + 1;
    const numZerosToTheBack = (num > id.arr.length) ? (num - id.arr.length) : 0;
    const digitOnly = id.arr.map(i => i.digit);
    let resultArr: number[];
    if (id.arr.length < num) {
      resultArr = digitOnly.concat(new Array<number>(numZerosToTheBack).fill(0));
    } else {
      resultArr = digitOnly.slice(0, num);
    }
    return new CustomNumber(resultArr);
  }

  // Implement exactly as Logoot paper, bottom of page 4
  static constructPosition(digits: CustomNumber, id1: CRDTId, id2: CRDTId, siteId: number, clock: number): CRDTId {
    const identifiersArray = new Array<Identifier>(digits.arr.length);

    for (let i = 0; i < identifiersArray.length; i++) {
      if (i === identifiersArray.length - 1) {
        identifiersArray[i] = new Identifier(digits.arr[i], siteId);
      } else if (id1.arr[i] && digits.arr[i] === id1.arr[i].digit) { // id1.arr[i] might not exist
        identifiersArray[i] = new Identifier(digits.arr[i], id1.arr[i].siteId);
      } else if (id2.arr[i] && digits.arr[i] === id2.arr[i].digit) { // id2.arr[i] might not exist
        identifiersArray[i] = new Identifier(digits.arr[i], id2.arr[i].siteId);
      } else {
        identifiersArray[i] = new Identifier(digits.arr[i], siteId);
      }
    }

    return new CRDTId(identifiersArray, clock);
  }


  toString(): string {
    let description = '<';
    for (let i = 0; i < this.arr.length; i++) {
      description = description + this.arr[i].toString();
    }
    description = description + this.clockValue + '>';
    return description;
  }

}

export class Identifier {
  digit: number;     /* digit is equivalent to pos in Logoot paper page 4 definition 1 line 1 */
  siteId: number;    // siteId is an integer for now, maybe we will use a Universal ID generator library later

  constructor(digit: number, siteId: number) {
    this.digit = digit;
    this.siteId = siteId;
  }

  // Compare by digit, use siteId to break tie
  compareTo(other: Identifier): number {
    if (this.digit == other.digit) {
      return this.siteId - other.siteId;
    }
    return this.digit - other.digit;
  }

  toString(): string {
    return '<' + this.digit + ',' + this.siteId + '>';
  }
}
