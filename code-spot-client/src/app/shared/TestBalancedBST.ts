import { BalancedBST, IsObject } from './BalancedBST';
import { CRDT, CRDTId, Identifier } from './CRDT';
import { CustomNumber } from './CustomNumber';

class Integer implements IsObject {
  num: number;
  constructor(n: number) {
    this.num = n;
  }
  compareTo(other: Integer): number {
    return this.num - other.num;
  }
  toString() {
    return '' + this.num;
  }
}

function testInsertAndRemove(numberOfOperations: number): void {
  let numError = 0;
  let clock = 0;

  const sortedArr = new Array<CRDT>();
  const bst = new BalancedBST<CRDT>();
  const begCRDT = new CRDT('_beg', new CRDTId([new Identifier(1, 0)], clock++));
  const endCRDT = new CRDT(
    '_end',
    new CRDTId([new Identifier(CustomNumber.BASE - 1, 0)], clock++)
  );
  bst.insert(begCRDT);
  bst.insert(endCRDT);
  insertSorted(sortedArr, begCRDT);
  insertSorted(sortedArr, endCRDT);

  for (let i = 0; i < numberOfOperations; i++) {
    if (Math.random() < 0.7) {
      const randomCRDT = generateRandomCRDT(clock++);
      const bstReturnIndex = bst.insert(randomCRDT);
      const arrReturnIndex = insertSorted(sortedArr, randomCRDT);
      if (bstReturnIndex !== arrReturnIndex) {
        console.error('The return value of insert function is incorrect!');
        numError++;
      }
    } else {
      if (bst.getSize() > 2) {
        // random index except 0 and length - 1
        const randomIndexToRemove =
          Math.floor(Math.random() * (bst.getSize() - 2)) + 1;
        const crdtToBeRemoved = bst.getDataAt(randomIndexToRemove);
        const bstReturnIndex = bst.remove(crdtToBeRemoved);
        const arrReturnIndex = removeSorted(sortedArr, crdtToBeRemoved);
        if (bstReturnIndex !== arrReturnIndex) {
          console.error('The return value of remove function is incorrect!');
          numError++;
        }
      }
    }
    if (bst.inorderToString() !== arrToString(sortedArr)) {
      console.error('The tree does not remains Binary Search property!');
      numError++;
    }
  }

  console.log(
    'Test insert and remove by executing ' +
      numberOfOperations +
      ' operations, ' +
      numError +
      ' errors found'
  );
}

function testOrderStatistics(numberOfOperations: number) {
  let numError = 0;
  let clock = 0;

  const sortedArr = new Array<CRDT>();
  const bst = new BalancedBST<CRDT>();
  const begCRDT = new CRDT('_beg', new CRDTId([new Identifier(1, 0)], clock++));
  const endCRDT = new CRDT(
    '_end',
    new CRDTId([new Identifier(CustomNumber.BASE - 1, 0)], clock++)
  );
  bst.insert(begCRDT);
  bst.insert(endCRDT);
  insertSorted(sortedArr, begCRDT);
  insertSorted(sortedArr, endCRDT);

  for (let i = 0; i < numberOfOperations; i++) {
    if (Math.random() < 0.7) {
      const randomCRDT = generateRandomCRDT(clock++);
      bst.insert(randomCRDT);
      insertSorted(sortedArr, randomCRDT);
    } else {
      if (bst.getSize() > 2) {
        // random index except 0 and length - 1
        const randomIndexToRemove =
          Math.floor(Math.random() * (bst.getSize() - 2)) + 1;
        const crdtToBeRemoved = bst.getDataAt(randomIndexToRemove);
        bst.remove(crdtToBeRemoved);
        removeSorted(sortedArr, crdtToBeRemoved);
      }
    }

    // Test getIndex()
    for (let j = 0; j < sortedArr.length; j++) {
      const curData = sortedArr[j];
      if (bst.getIndex(curData) !== j) {
        console.error('getIndex() failed');
        numError++;
      }
    }

    // Test getDataAt()
    for (let j = 0; j < sortedArr.length; j++) {
      if (bst.getDataAt(j).compareTo(sortedArr[j]) !== 0) {
        console.error('getDataAt() failed');
        numError++;
      }
    }
  }

  console.log(
    'Test order statistics by executing ' +
      numberOfOperations +
      ' operations, ' +
      numError +
      ' errors found'
  );
}

function testTreeIsBalanced(numberOfOperations: number) {
  let numError = 0;
  let clock = 0;

  const bst = new BalancedBST<CRDT>();
  const begCRDT = new CRDT('_beg', new CRDTId([new Identifier(1, 0)], clock++));
  const endCRDT = new CRDT(
    '_end',
    new CRDTId([new Identifier(CustomNumber.BASE - 1, 0)], clock++)
  );
  bst.insert(begCRDT);
  bst.insert(endCRDT);

  for (let i = 0; i < numberOfOperations; i++) {
    if (Math.random() < 0.9) {
      bst.insert(generateRandomCRDT(clock++));
    } else {
      if (bst.getSize() > 2) {
        // random index except 0 and length - 1
        const randomIndexToRemove =
          Math.floor(Math.random() * (bst.getSize() - 2)) + 1;
        const crdtToBeRemoved = bst.getDataAt(randomIndexToRemove);
        bst.remove(crdtToBeRemoved);
      }
    }

    if (!bst.isBalance()) {
      console.error('Error: Tree is not balanced!');
      numError++;
    }
  }

  if (numError === 0) {
    console.log(
      'Test tree balance by executing ' +
        numberOfOperations +
        ' operations, tree remains balanced after every single operations! 0 errors found'
    );
  } else {
    console.log(
      'Test tree balance by executing ' +
        numberOfOperations +
        ' operations, ' +
        numError +
        ' errors found'
    );
  }
}

function insertSorted(sortedArr: CRDT[], data: CRDT): number {
  for (let i = 0; i < sortedArr.length; i++) {
    if (data.compareTo(sortedArr[i]) === 0) {
      return -1;
    } else if (data.compareTo(sortedArr[i]) < 0) {
      sortedArr.splice(i, 0, data);
      return i;
    }
  }
  sortedArr.push(data);
  return sortedArr.length - 1;
}

function removeSorted(sortedArr: CRDT[], data: CRDT): number {
  for (let i = 0; i < sortedArr.length; i++) {
    if (data.compareTo(sortedArr[i]) === 0) {
      sortedArr.splice(i, 1);
      return i;
    }
  }
  return -1;
}

function arrToString(arrSorted: CRDT[]): string {
  let res = '';
  for (let i = 0; i < arrSorted.length; i++) {
    res = res + arrSorted[i].toString();
  }
  return res;
}

function generateRandomCRDT(clock: number): CRDT {
  const MAX_NUMBER_OF_IDENTIFIER = 50;
  const numberOfSiteId = 10;

  const numberOfIdentifiers =
    Math.floor(Math.random() * MAX_NUMBER_OF_IDENTIFIER) + 1;
  const identifierArr: Identifier[] = [];
  for (let i = 0; i < numberOfIdentifiers; i++) {
    const randomDigit = Math.floor(Math.random() * 100000) + 1;
    const randomSiteId = Math.floor(Math.random() * numberOfSiteId) + 1;
    const randomIdentifier = new Identifier(randomDigit, randomSiteId);
    identifierArr.push(randomIdentifier);
  }
  return new CRDT('a', new CRDTId(identifierArr, clock));
}

testInsertAndRemove(1000);
testOrderStatistics(10000);
testTreeIsBalanced(10000);
