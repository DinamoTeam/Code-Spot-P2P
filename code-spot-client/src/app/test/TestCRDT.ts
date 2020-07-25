import { CRDTId, Identifier } from '../shared/CRDT';
import { CustomNumber } from '../shared/CustomNumber';

function testGenerateNPositionsBetween(numberOfGenerates: number): void {
  const NUMBER_OF_SITE_ID = 5;
  const MAX_N_EACH_GENERATE = 100;
  let numError = 0;
  let clock = 1;
  const arr = new Array<CRDTId>();
  const beginCRDTId = new CRDTId([new Identifier(1, 0)], clock++);
  const endCRDTId = new CRDTId(
    [new Identifier(CustomNumber.BASE - 1, 0)],
    clock++
  );
  arr.push(beginCRDTId);
  arr.push(endCRDTId);

  for (let i = 0; i < numberOfGenerates; i++) {
    // random index except 0 and arr.length. This randomIndex will be the index of the newly inserted elements
    const randomIndex = Math.floor(Math.random() * (arr.length - 1)) + 1;
    const siteId = Math.floor(Math.random() * NUMBER_OF_SITE_ID) + 1;
    const numElementsToGenerate =
      Math.floor(Math.random() * MAX_N_EACH_GENERATE) + 1;
    const newCRDTIds = CRDTId.generateNPositionsBetween(
      arr[randomIndex - 1],
      arr[randomIndex],
      numElementsToGenerate,
      siteId,
      clock
    );
    clock += numElementsToGenerate;
    for (let j = 0; j < newCRDTIds.length; j++) {
      arr.splice(randomIndex + j, 0, newCRDTIds[j]); // insert new elements between randomIndex-1 and randomIndex
    }

    if (!isCRDTIdArrayIncreasing(arr)) {
      console.error(
        'ERROR: testGenerateNPositionsBetween() array is not increasing'
      );
      numError++;
    }
  }

  console.log(
    'Tested CRDT.testGenerateNPositionsBetween() by randomly generate ' +
      numberOfGenerates +
      ' times, ' +
      numError +
      ' errors found'
  );
}

function isCRDTIdArrayIncreasing(arr: CRDTId[]): boolean {
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i].compareTo(arr[i + 1]) >= 0) {
      // if arr[i] >= arr[i+1]
      return false;
    }
  }
  return true;
}

function printCRDTIdArray(arr: CRDTId[]): void {
  console.log('---------------Start---------------');
  // tslint:disable-next-line: prefer-for-of
  for (let i = 0; i < arr.length; i++) {
    console.log(arr[i].toString());
  }
  console.log('---------------End---------------');
}

// Don't choose numberOfTestCases too big
// We check isCRDTIdArrayIncreasing after EVERY iteration
testGenerateNPositionsBetween(1000);
