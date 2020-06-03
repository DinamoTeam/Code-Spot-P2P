import { BalancedBST, IsObject } from './BalancedBST';

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
  const MIN_DATA = -10000;
  const MAX_DATA = 10000;
  let numError = 0;

  const sortedArr = new Array<Integer>();
  const bst = new BalancedBST<Integer>();

  for (let i = 0; i < numberOfOperations; i++) {
    const randomNumber =
      Math.floor(Math.random() * (MAX_DATA - MIN_DATA + 1)) + MIN_DATA;
    if (Math.random() < 0.5) {
      bst.insert(new Integer(randomNumber));
      insertSorted(sortedArr, new Integer(randomNumber));
    } else {
      bst.remove(new Integer(randomNumber));
      removeSorted(sortedArr, new Integer(randomNumber));
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
  const MIN_DATA = -10000;
  const MAX_DATA = 10000;
  let numError = 0;

  const sortedArr = new Array<Integer>();
  const bst = new BalancedBST<Integer>();

  for (let i = 0; i < numberOfOperations; i++) {
    const randomNumber =
      Math.floor(Math.random() * (MAX_DATA - MIN_DATA + 1)) + MIN_DATA;
    if (Math.random() < 0.5) {
      bst.insert(new Integer(randomNumber));
      insertSorted(sortedArr, new Integer(randomNumber));
    } else {
      bst.remove(new Integer(randomNumber));
      removeSorted(sortedArr, new Integer(randomNumber));
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

function insertSorted(sortedArr: Integer[], data: Integer): void {
  for (let i = 0; i < sortedArr.length; i++) {
    if (data.compareTo(sortedArr[i]) === 0) {
      return;
    } else if (data.compareTo(sortedArr[i]) < 0) {
      sortedArr.splice(i, 0, data);
      return;
    }
  }
  sortedArr.push(data);
}

function removeSorted(sortedArr: Integer[], data: Integer): void {
  for (let i = 0; i < sortedArr.length; i++) {
    if (data.compareTo(sortedArr[i]) === 0) {
      sortedArr.splice(i, 1);
    }
  }
}

function arrToString(arrSorted: Integer[]): string {
  let res = '';
  for (let i = 0; i < arrSorted.length; i++) {
    res = res + arrSorted[i].toString();
  }
  return res;
}

testInsertAndRemove(10000);
testOrderStatistics(10000);

/*
const bst = new BalancedBST<Integer>();
bst.insert(new Integer(2));
bst.insert(new Integer(100));
bst.insert(new Integer(-3));
bst.insert(new Integer(5));
bst.insert(new Integer(4));
bst.insert(new Integer(8));
bst.remove(new Integer(5));
bst.remove(new Integer(100));

for (let i = 0; i < bst.getSize(); i++) {
  console.log(bst.getDataAt(i).toString());
}
*/
