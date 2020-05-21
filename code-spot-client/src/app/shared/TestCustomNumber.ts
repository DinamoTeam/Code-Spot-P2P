import { CustomNumber } from './CustomNumber';

const MAX_NUMBER_BASE_10 = 100000; // For base 10 testing only

function numToArrDigit(n: number): number[] {
  let arr: number[] = [];
  while (n > 0) {
    arr.unshift(n % 10);
    n = Math.floor(n / 10);
  }
  return arr;
}

// Generate random a, b in base 10. Take b - a like normal and b - a using CustomNumber
// Console.error() if actualResult != expectedResult
function testSubtractGreaterThanBase10(numberOfTestCases: number): void {
  let onlyWorkForBase = 10;
  if (CustomNumber.BASE !== onlyWorkForBase) {
    console.error('Not in base 10, cannot use testSubtractGreaterThanBase10');
    return;
  }

  let numError = 0;

  for (let i = 0; i < numberOfTestCases; i++) {
    let a = Math.floor(Math.random() * MAX_NUMBER_BASE_10) + 1; // Generate number from 1 to MAX_NUMBER
    let b = MAX_NUMBER_BASE_10;
    while (b >= a) {
      b = Math.floor(Math.random() * MAX_NUMBER_BASE_10); // b from 0 to MAX_NUMBER-1
    }
    let resultShouldBe = a - b;

    let customNumberA = new CustomNumber(numToArrDigit(a));
    let customNumberB = new CustomNumber(numToArrDigit(b));
    let actualResult = CustomNumber.subtractGreaterThan(customNumberA, customNumberB);

    if (actualResult.arr[0] == 0) {
      console.error('ERROR: testSubtractGreaterThanBase10: Error: 0 at beginning!');
      numError++;
    }

    if (resultShouldBe !== parseInt(actualResult.toString())) {
      console.error('ERROR: ' + a + ' - ' + b + ' = ' + resultShouldBe +
                    ', actualResult: ' + actualResult.toString());
      numError++;
    }
  }
  console.log('Tested CustomNumer.subtractGreaterThan() with ' + numberOfTestCases
    + ' test cases, ' + numError + ' errors found');
}

// Generate random a, b in base 10. Take a + b like normal and a + b using CustomNumber
// Console.error() if actualResult != expectedResult
function testAddBase10(numberOfTestCases: number): void {
  let onlyWorkForBase = 10;
  if (CustomNumber.BASE !== onlyWorkForBase) {
    console.error('Not in base 10, cannot use testAddBase10');
    return;
  }

  let numError = 0;

  for (let i = 0; i < numberOfTestCases; i++) {
    let a = Math.floor(Math.random() * MAX_NUMBER_BASE_10) + 1; // Generate number from 1 to MAX_NUMBER
    let b = Math.floor(Math.random() * MAX_NUMBER_BASE_10) + 1;
    let resultShouldBe = a + b;

    let customNumberA = new CustomNumber(numToArrDigit(a));
    let customNumberB = new CustomNumber(numToArrDigit(b));
    let actualResult = CustomNumber.add(customNumberA, customNumberB);

    if (actualResult.arr[0] == 0) {
      console.error('ERROR: testAddBase10: Error: 0 at beginning!');
      numError++;
    }

    if (resultShouldBe !== parseInt(actualResult.toString())) {
      console.error('ERROR: ' + a + ' + ' + b + ' = ' + resultShouldBe +
                    ', actualResult: ' + actualResult.toString());
      numError++;
    }
  }

  console.log('Tested CustomNumer.add() with ' + numberOfTestCases
    + ' test cases, ' + numError + ' errors found');
}

// Generate a random CustomNumber called bigger
// Generate 100 numbers less than bigger by generateLessThan() and then compare it with bigger
function testGenerateLessThan(numberOfTestCases: number): void {
  const MAX_NUM_DIGIT = 1;
  const NUM_TEST_PER_NUMBER = 100;
  let numError = 0;
  for (let i = 0; i < numberOfTestCases; i++) {
    const numDigits = Math.floor(Math.random() * MAX_NUM_DIGIT) + 1;
    const arr: number[] = [];
    for (let j = 0; j < numDigits; j++) {
      arr[j] = Math.floor(Math.random() * CustomNumber.BASE);
    }
    let bigger = new CustomNumber(arr);
    // bigger should never be 0 or 1, since generateLessThan must return sth >= 1
    if (bigger.compareTo(new CustomNumber([2])) < 0) {
      bigger = new CustomNumber([2]);
    }
    for (let j = 0; j < NUM_TEST_PER_NUMBER; j++) {
      const smaller = CustomNumber.generateLessThan(bigger);
      if (smaller.compareTo(new CustomNumber([0])) === 0) {
        console.error('ERROR: Test generateLessThan, it returns 0 (It MUST NOT)');
        numError++;
      } 
      if (smaller.compareTo(bigger) >= 0) { // If smaller is actually not smaller
        console.error('ERROR: Test generateLessThan, smaller of ' +
          bigger.toString() + ' is ' + smaller.toString());
        numError++;
      }
    }
  }
  console.log('Tested CustomNumer.generateLessThan() with ' + numberOfTestCases
    + ' test cases, ' + numError + ' errors found');
}

testSubtractGreaterThanBase10(10000); // Onlu work in base 10, check CustomNumber.BASE
testAddBase10(10000); // Onlu work in base 10, check CustomNumber.BASE

testGenerateLessThan(1000); // Choose small numberOfTestCases since each test case will be tested 100 times

