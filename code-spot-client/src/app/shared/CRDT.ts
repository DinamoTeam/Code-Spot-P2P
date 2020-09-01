// IMPORTANT: Start CRDT arr with <1, ServerID> and end with <INF, ServerID>. ServerID = 0
//                                 ^ (not 0)
// Start CRDT arr with <0, ServerID> will make the program crash in some edge cases

import { CustomNumber } from './CustomNumber';
import { IsObject } from './BalancedBST';

/**
 * Each CRDT object will correspond to 1 character in the text editor
 * A sorted (increasing order) CRDT array will correspond to the whole text
 */
export class CRDT implements IsObject {
  ch: string;
  id: CRDTId;

  constructor(character: string, id: CRDTId) {
    this.ch = character;
    this.id = id;
  }

  /**
   * Return CRDT object from toString() version of CRDT
   */
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

  toString(): string {
    return this.id.toString() + this.ch;
  }

  // Compare CRDT by its id
  compareTo(other: CRDT): number {
    return this.id.compareTo(other.id);
  }
}

/**
 * CRDTId is equivalent to position identifier in Logoot paper page 4 definition 1
 */
export class CRDTId {
  arr: Identifier[]; // arr is equivalent to position in Logoot paper page 4 definition 1 line 3
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

  /**
   * Generate N globally unique CRDTs between id1 and id2
   */
  static generateNPositionsBetween(
    id1: CRDTId,
    id2: CRDTId,
    N: number,
    siteId: number,
    clock: number
  ): CRDTId[] {
    /**
     * A few things to keep in mind before you read this function:
     * 0/ Reading this research paper helps: https://hal.inria.fr/inria-00432368/document (Especially page 4)
     *
     * 1/ A CRDT looks like <<3,4><5,6>9>a where <3,4><5,6> is CRDTId, 9 is clock number and 'a' is a character
     *
     * 2/ A CRDTId is an array of identifiers. Each identifier looks like <800,951> where (800) is digit and (951) is siteId
     * To compare 2 identifiers, we first compare its digit (800). If digits are equal, compare its siteId (951)
     * To compare 2 CRDTIds, we compare each corresponding identifiers, left to right:
     * - The CRDTId contains the first bigger identifier is bigger
     * - If the corresponding identifiers are all equal, the longer CRDTId is bigger
     * - If the identifier arrays are exactly the same, compare the clock
     * Ex: <3,4> is bigger than <1,4><99,9><9999,99> because <3,4> is bigger than <1,4>
     * Ex: <3,4><9,9> is bigger than <3,4> because all corresponding identifiers are equal but the first CRDTId is longer
     *
     * 3/ You might find 'digit' (800) rather strange. Remember each 'digit' is a digit of a CustomNumber with base Math.pow(2, 25)
     *
     * 4/ To compare 2 CRDTs, we compare their CRDTIds
     */

    /**
     * Rough idea of this function:
     * GOAL: We need to generate N spots between id1 and id2
     *
     * - Step 1: + Take the first few digits of each identifiers of id1 and id2, map them into 2 CustomNumbers (prefix1 and prefix2).
     * + 'The first few' has to be 'enough' so that delta = prefix1 - prefix2 has enough spots for N elements.
     * + If we took all digits and delta is still not big enough, keep adding MAX_DIGIT (CustomNumber.BASE-1) to the back of
     * prefix1 and prefix2 until delta is big enough
     * + Note: If id2 > id1 because a siteId of an identifier of id2 is bigger,
     * then we don't need to find delta this way. Why? Please read the code and comments below
     *
     * - Step 2: + Now, let's say N = 10 and delta (in base 10 - for illustration purposes) = 100 => we need to allocate 10 positions and
     * we have 99 spots (#spots = delta - 1. Ex: 9-5 = 4, we have 3 spots: 6, 7, 8)
     * + Let step = 99 / 10 = 9. Then 10 CRDTIds's digits can be 11, 20, 29,... 92
     *
     * - Step 3: Contruct CRDTIds from these digits using constructPosition(), we get 10 CRDTIds.
     */

    /**
     * Step 1: Find prefix1, prefix2 and delta
     */
    let index = 0;
    const shorterLength = Math.min(id1.arr.length, id2.arr.length);

    // Find the first different identifier
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

    // If id2 > id1 because id2 is longer OR a digit is bigger
    if (
      index === shorterLength ||
      id1.arr[index].digit !== id2.arr[index].digit
    ) {
      index--;

      // loop until delta >= N + 1, so that we have at least N spots
      while (delta.compareTo(NPlus1InBaseBASE) < 0) {
        index++;
        prefix1 = CRDTId.prefix(id1, index);
        prefix2 = CRDTId.prefix(id2, index);
        delta = CustomNumber.subtractGreaterThan(prefix2, prefix1);
      }
    }
    // If id2 > id1 because a siteId is bigger
    else {
      // id1 = <1, 1>...
      // id2 = <1, 3>...
      // If newId = <1, 1>..., newId will always < id2 because siteId 1 is less than siteId 3
      // With this guarantee, we now only need to find newId = <1, 1>... such that newId > id1. Below is how

      prefix2 = CRDTId.prefix(id2, index);

      // Keep adding MAX_DIGIT to the back of prefix2 until we have enough spots between prefix1 and prefix2
      // Why adding MAX_DIGIT? Because keep adding MAX_DIGIT guarantees we'll eventually have something > prefix1 enough,
      // and also, prefix2 will always < id2 because of the reason above
      while (delta.compareTo(NPlus1InBaseBASE) < 0) {
        index++;
        prefix1 = CRDTId.prefix(id1, index);
        prefix2.arr.push(CustomNumber.BASE - 1); // Add max digit (in base 10, that would be 9) to the end of prefix2
        delta = CustomNumber.subtractGreaterThan(prefix2, prefix1);
      }
    }

    /**
     * Step 2: Generate N CRDTIds digits
     * and Step 3: create N CRDTIds from these digits
     */
    const step = CustomNumber.naiveFloorDivide(
      CustomNumber.subtractGreaterThan(delta, new CustomNumber([1])),
      NInBaseBASE
    );
    let r = prefix1;
    const CRDTIdList = new Array<CRDTId>();

    /**
     * Continue with the example above: when N = 10, delta = 100 and step = 10, we don't want to place CRDTIds too evenly
     * because the majority of the time, we insert text to the right side of the last inserted character
     * We want our 'CRDTIds' to look like 13, 16, 18, 20, 26,... so we still have 'spots' if we want to insert some more
     * without having to grow our Identifier array
     */
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

  /**
   * Take the first 'index' + 1 digits, add 0 if not enough digits, and then convert to a CustomNumber
   */
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

  /**
   * Implement exactly as Logoot paper, bottom of page 4
   * Note: With this implementation, we can always get the siteId of the person
   * who created this character (It is the siteId of the last identifier)
   */
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

  /**
   * Compare 2 identifier arrays from left to right. Terminate if one identifier is bigger than the other
   * If one array runs out of length, the longer is the bigger
   */
  compareTo(other: CRDTId): number {
    const length1 = this.arr.length;
    const length2 = other.arr.length;
    const smallerLength = Math.min(length1, length2);

    for (let i = 0; i < smallerLength; i++) {
      if (this.arr[i].compareTo(other.arr[i]) === 0) {
        continue;
      } else {
        return this.arr[i].compareTo(other.arr[i]);
      }
    }

    if (length1 === length2) {
      // This rarely, rarely happens
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

  /**
   * Compare by digit. Use siteId to break tie
   */
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
