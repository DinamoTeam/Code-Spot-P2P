// IMPORTANT: Start CRDT arr with <1, ServerID> and end with <INF, ServerID>. ServerID = 0
//                                 ^ (not 0)
// CustomNumber trim 0s at the beginning

import { CustomNumber } from './CustomNumber';
import { IsObject } from './BalancedBST';

// Each CRDT object will correspond to 1 character in the text editor
// A sorted (increasing order) CRDT array will correspond to the whole text
export class CRDT implements IsObject {
  ch: string;
  id: CRDTId;

  constructor(character: string, id: CRDTId) {
    this.ch = character;
    this.id = id;
  }

  static parse(crdtStr: string): CRDT {
    let tokens = crdtStr.split('');
    tokens.shift();

    // Get char
    const ch = String(tokens.pop());

    // Get clock value
    const clockArr = [];
    let i = tokens.length - 2;
    while (i > 0) {
      if (tokens[i] === '>') {
        break;
      }

      clockArr.unshift(tokens[i]);
      i--;
    }

    const clockValue = Number(clockArr.join(''));
    tokens = tokens.slice(0, i + 1);

    // Get identifiers
    const identifiers = new Array<Identifier>();
    let beg = 0;
    let end = 0;
    while (end < tokens.length) {
      if (tokens[end] === '>') {
        const tempArr = tokens.slice(beg + 1, end);
        const identifierStr = tempArr.join('');
        const identifierNums = identifierStr.split(',');

        const identifier = new Identifier(
          Number(identifierNums[0]),
          Number(identifierNums[1])
        );

        identifiers.push(identifier);

        end++;
        beg = end;
      }

      end++;
    }

    const crdtId = new CRDTId(identifiers, clockValue);
    const crdt = new CRDT(ch, crdtId);

    return crdt;
  }

  // NEVER user toString() to turn a CRDT object to a string. It's incredibly slow!
  // USE JSON.stringify please!!!
  toString(): string {
    return this.id.toString() + this.ch;
  }

  // Compare CRDT by its id
  compareTo(other: CRDT): number {
    return this.id.compareTo(other.id);
  }
}

/* CRDTId is equivalent to position identifier in Logoot paper page 4 definition 1 */
export class CRDTId {
  arr: Identifier[]; /* arr is equivalent to position in Logoot paper page 4 definition 1 line 3 */
  clockValue: number;

  constructor(identifierArr: Identifier[], clock: number) {
    this.arr = identifierArr;
    this.clockValue = clock;
  }

  static deepCopy(crdtId: CRDTId): CRDTId {
    const deepCopiedArr: Identifier[] = [];
    for (let i = 0; i < crdtId.arr.length; i++) {
      deepCopiedArr.push(Identifier.deepCopy(crdtId.arr[i]));
    }
    return new CRDTId(deepCopiedArr, crdtId.clockValue);
  }

  // Generate an CRDTId in between id1 and id2
  // Rough idea: 2 cases
  // Case 1: First non match indices - their digits are different
  // delta = id2 - id1
  // idBetweenId1AndId2 = id1 + lessThanDeltaButBiggerThanZero
  // Case 2: First non match indices - their sites are different
  // Fills the tail id2 with BASE-1, then do similar thing as case 1
  static generatePositionBetween(
    id1: CRDTId,
    id2: CRDTId,
    siteId: number,
    clock: number
  ): CRDTId {
    let index = 0;
    const shorterLength = Math.min(id1.arr.length, id2.arr.length);

    // Find the first different index
    while (index < shorterLength) {
      if (id1.arr[index].compareTo(id2.arr[index]) !== 0) {
        // First time not match
        break;
      }
      index++;
    }

    let prefix1: CustomNumber;
    let prefix2: CustomNumber;
    let delta = new CustomNumber([0]);

    if (
      index === shorterLength ||
      id1.arr[index].digit !== id2.arr[index].digit
    ) {
      // digits are different
      index--; // decrease to fit with the while loop below
      // loop until delta >= 2. (Eg: 7-5=2 => There's 1 spot for 6 in the middle. 7-6=1 doesn't work)
      // Note: use prefix is enough because 2 > 1341242 (like version number) - we know it's bigger right from the first index
      while (delta.compareTo(new CustomNumber([2])) < 0) {
        // while delta < 2
        index++;
        prefix1 = CRDTId.prefix(id1, index);
        prefix2 = CRDTId.prefix(id2, index);
        delta = CustomNumber.subtractGreaterThan(prefix2, prefix1);
      }
    } else {
      // same digit but different siteIds

      // id1 = <1, 1>...
      // id2 = <1, 3>...
      // newId = <1, 1>...anything
      // newId will always < id2
      // Therefore we only need to find newId = <1, 1>... so that newId > id1. Below is how

      // No need to do index--
      prefix2 = CRDTId.prefix(id2, index);

      // generate something bigger than id1.arr[index+1->id1.arr.length-1]
      while (delta.compareTo(new CustomNumber([2])) < 0) {
        index++;
        prefix1 = CRDTId.prefix(id1, index);
        prefix2.arr.push(CustomNumber.BASE - 1); // Add max digit (in base 10, that would be 9) to the end of prefix2
        delta = CustomNumber.subtractGreaterThan(prefix2, prefix1);
      }
    }

    const smallerThanDelta = CustomNumber.generateLessThan(delta); // < delta but > 0
    const numberBetweenPrefix1AndPrefix2 = CustomNumber.add(
      prefix1,
      smallerThanDelta
    ); // idBetween = id1 + lessThanDelta

    const newCRDTIdBetweenId1AndId2 = CRDTId.constructPosition(
      numberBetweenPrefix1AndPrefix2,
      id1,
      id2,
      siteId,
      clock
    );
    return newCRDTIdBetweenId1AndId2;
  }

  static generateNPositionsBetween(
    id1: CRDTId,
    id2: CRDTId,
    N: number,
    siteId: number,
    clock: number
  ): CRDTId[] {
    let index = 0;
    const shorterLength = Math.min(id1.arr.length, id2.arr.length);

    // Find the first different index
    while (index < shorterLength) {
      if (id1.arr[index].compareTo(id2.arr[index]) !== 0) {
        // First time not match
        break;
      }
      index++;
    }

    let prefix1: CustomNumber;
    let prefix2: CustomNumber;
    let delta = new CustomNumber([0]);
    const NPlus1InBaseBASE = CustomNumber.decimalToCustomNumber(N + 1);
    const NInBaseBASE = CustomNumber.decimalToCustomNumber(N);

    if (
      index === shorterLength ||
      id1.arr[index].digit !== id2.arr[index].digit
    ) {
      // digits are different
      index--; // decrease to fit with the while loop below
      // loop until delta >= N + 1, so that we have N spots
      // Note: use prefix is enough because 2 > 1341242 (like version number) - we know it's bigger right from the first index
      while (delta.compareTo(NPlus1InBaseBASE) < 0) {
        index++;
        prefix1 = CRDTId.prefix(id1, index);
        prefix2 = CRDTId.prefix(id2, index);
        delta = CustomNumber.subtractGreaterThan(prefix2, prefix1);
      }
    } else {
      // same digit but different siteIds

      // id1 = <1, 1>...
      // id2 = <1, 3>...
      // newId = <1, 1>...anything
      // newId will always < id2
      // Therefore we only need to find newId = <1, 1>... so that newId > id1. Below is how

      // No need to do index--
      prefix2 = CRDTId.prefix(id2, index);

      // generate something bigger than id1.arr[index+1->id1.arr.length-1]
      while (delta.compareTo(NPlus1InBaseBASE) < 0) {
        index++;
        prefix1 = CRDTId.prefix(id1, index);
        prefix2.arr.push(CustomNumber.BASE - 1); // Add max digit (in base 10, that would be 9) to the end of prefix2
        delta = CustomNumber.subtractGreaterThan(prefix2, prefix1);
      }
    }

    const step = CustomNumber.naiveFloorDivide(
      CustomNumber.subtractGreaterThan(delta, new CustomNumber([1])),
      NInBaseBASE
    );
    let r = prefix1;
    const CRDTIdList = new Array<CRDTId>();

    for (let i = 0; i < N; i++) {
      const random1ToStepInclusive = CustomNumber.generateLessThan(
        CustomNumber.add(step, new CustomNumber([1]))
      );
      const crdtIdBetween = CRDTId.constructPosition(
        CustomNumber.add(r, random1ToStepInclusive),
        id1,
        id2,
        siteId,
        clock++
      );
      CRDTIdList.push(crdtIdBetween);
      r = CustomNumber.add(r, random1ToStepInclusive);
    }

    return CRDTIdList;
  }

  // Take elements 0 to 'index' inclusive (digit only) and map to a number array.
  // Add 0 to the back if arr.length < num, and then convert to a CustomNumber
  static prefix(id: CRDTId, index: number): CustomNumber {
    const num = index + 1;
    const numZerosToTheBack = num > id.arr.length ? num - id.arr.length : 0;
    const digitOnly = id.arr.map((i) => i.digit);
    let resultArr: number[];
    if (id.arr.length < num) {
      resultArr = digitOnly.concat(
        new Array<number>(numZerosToTheBack).fill(0)
      );
    } else {
      resultArr = digitOnly.slice(0, num);
    }
    return new CustomNumber(resultArr);
  }

  // Implement exactly as Logoot paper, bottom of page 4
  static constructPosition(
    digits: CustomNumber,
    id1: CRDTId,
    id2: CRDTId,
    siteId: number,
    clock: number
  ): CRDTId {
    const identifiersArray = new Array<Identifier>(digits.arr.length);

    for (let i = 0; i < identifiersArray.length; i++) {
      if (i === identifiersArray.length - 1) {
        identifiersArray[i] = new Identifier(digits.arr[i], siteId);
      } else if (id1.arr[i] && digits.arr[i] === id1.arr[i].digit) {
        // id1.arr[i] might not exist
        identifiersArray[i] = new Identifier(digits.arr[i], id1.arr[i].siteId);
      } else if (id2.arr[i] && digits.arr[i] === id2.arr[i].digit) {
        // id2.arr[i] might not exist
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

  // Compare 2 identifier arrays from left to right. Terminate if one identifier is bigger than the other
  // If one array runs out of length, the longer is the bigger
  compareTo(other: CRDTId): number {
    const length1 = this.arr.length;
    const length2 = other.arr.length;
    const smallerLength = Math.min(length1, length2);

    // Compare corresponding identifiers inside arr
    for (let i = 0; i < smallerLength; i++) {
      if (this.arr[i].compareTo(other.arr[i]) === 0) {
        continue; // Equal => move onto the next
      } else {
        return this.arr[i].compareTo(other.arr[i]); // Otherwise, the ith identifiers determine smaller/bigger
      }
    }

    // If we go to the end of one arr, it means the "beginning part" is exactly equal
    // => If equal length, compare by clockValue. Otherwise, the one longer is bigger
    if (length1 === length2) {
      // This rarely, rarely happens!
      return this.clockValue - other.clockValue;
    }
    return length1 - length2;
  }
}

export class Identifier {
  digit: number; /* digit is equivalent to pos in Logoot paper page 4 definition 1 line 1 */
  siteId: number; // siteId is an integer for now, maybe we will use a Universal ID generator library later

  constructor(digit: number, siteId: number) {
    this.digit = digit;
    this.siteId = siteId;
  }

  static deepCopy(id: Identifier): Identifier {
    return new Identifier(id.digit, id.siteId);
  }

  // Compare by digit, use siteId to break tie
  compareTo(other: Identifier): number {
    if (this.digit === other.digit) {
      return this.siteId - other.siteId;
    }
    return this.digit - other.digit;
  }

  toString(): string {
    return '<' + this.digit + ',' + this.siteId + '>';
  }
}
