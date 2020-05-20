import { CustomNumber } from './CustomNumber';

const MAX_NUMBER_BASE_10 = 1000000; // For base 10 testing only

function numToArrDigit(n: number): number[] {
  let arr: number[] = [];
  while (n > 0) {
    arr.unshift(n % 10);
    n = Math.floor(n / 10);
  }
  return arr;
}

// Will console.error() an error if there is any
function testSubtractGreaterThanBase10(numberOfTestCases: number): void {

  let numError = 0;

  for (let i = 0; i < numberOfTestCases; i++) {
    let a = Math.floor(Math.random() * MAX_NUMBER_BASE_10) + 1; // Generate number from 1 to MAX_NUMBER
    let b = MAX_NUMBER_BASE_10;
    while (b >= a) {
      b = Math.floor(Math.random() * MAX_NUMBER_BASE_10) + 1;
    }
    let resultShouldBe = a - b;

    let customNumberA = new CustomNumber(numToArrDigit(a));
    let customNumberB = new CustomNumber(numToArrDigit(b));
    let actualResult = CustomNumber.subtractGreaterThan(customNumberA, customNumberB);

    if (actualResult.arr[0] == 0) {
      console.error('testSubtractGreaterThanBase10: Error: 0 at beginning!');
      numError++;
    }

    if (resultShouldBe !== parseInt(actualResult.toString())) {
      console.error(a + ' - ' + b + ' = ' + resultShouldBe + ', actualResult: ' + actualResult.toString());
      numError++;
    }
  }
  console.log('Tested CustomNumer.subtractGreaterThan() with ' + numberOfTestCases
    + ' test cases, ' + numError + ' errors found');
}

// Will console.error() an error if there is any
function testAddBase10(numberOfTestCases: number): void {

  let numError = 0;

  for (let i = 0; i < numberOfTestCases; i++) {
    let a = Math.floor(Math.random() * MAX_NUMBER_BASE_10) + 1; // Generate number from 1 to MAX_NUMBER
    let b = Math.floor(Math.random() * MAX_NUMBER_BASE_10) + 1;
    let resultShouldBe = a + b;

    let customNumberA = new CustomNumber(numToArrDigit(a));
    let customNumberB = new CustomNumber(numToArrDigit(b));
    let actualResult = CustomNumber.add(customNumberA, customNumberB);

    if (actualResult.arr[0] == 0) {
      console.error('testAddBase10: Error: 0 at beginning!');
      numError++;
    }

    if (resultShouldBe !== parseInt(actualResult.toString())) {
      console.error(a + ' + ' + b + ' = ' + resultShouldBe + ', actualResult: ' + actualResult.toString());
      numError++;
    }
  }

  console.log('Tested CustomNumer.add() with ' + numberOfTestCases
    + ' test cases, ' + numError + ' errors found');
}

testSubtractGreaterThanBase10(100000);
testAddBase10(100000);
