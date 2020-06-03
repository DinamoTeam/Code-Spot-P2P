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
    if (Math.random() < 0.9) {
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
      ' found'
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

const arr: Integer[] = [];
insertSorted(arr, new Integer(2));
insertSorted(arr, new Integer(100));
insertSorted(arr, new Integer(-3));
insertSorted(arr, new Integer(5));
insertSorted(arr, new Integer(4));
insertSorted(arr, new Integer(8));
removeSorted(arr, new Integer(5));
removeSorted(arr, new Integer(100));

console.log(bst.inorderToString());
console.log(arrToString(arr));

console.log(bst.inorderToString().length);
console.log(arrToString(arr).length);

const b = bst.inorderToString() === arrToString(arr);
console.log(b);
*/
