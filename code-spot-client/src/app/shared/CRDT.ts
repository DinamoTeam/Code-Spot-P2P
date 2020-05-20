// IMPORTANT: Start CRDT arr with <1, ServerID> and end with <INF, ServerID>. ServerID = 0
//                                 ^ (not 0)
// CustomNumber trim 0s at the beginning

export class CRDT {
  ch: string;
  id: CRDTId;

  compareTo(other: CRDT): number {
    return this.id.compareTo(other.id);
  }

}

/* CRDTId is equivalent to position identifier in Logoot paper page 4 definition 1 */
export class CRDTId {
  arr: Identifier[];   /* arr is equivalent to position in Logoot paper page 4 definition 1 line 3 */
  clockValue: number;

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
    if (length1 === length2) {
      return this.clockValue - other.clockValue;
    }
    return length1 - length2;
  }

  static generatePositionBetween(id1: CRDTId, id2: CRDTId, site: number): CRDTId {
    
    return null;
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

  compareTo(other: Identifier): number {
    // Compare by digit, use siteId to break tie
    if (this.digit == other.digit) {
      return this.siteId - other.siteId;
    }
    return this.digit - other.digit;
  }

  toString(): string {
    return '<' + this.digit + ',' + this.siteId + '>';
  }
}
