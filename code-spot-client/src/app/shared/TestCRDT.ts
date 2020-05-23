import { CRDTId, Identifier } from "./CRDT";
import { CustomNumber } from './CustomNumber';

// Idea: insert randomly 'numberOfElements' element to an array,
// occasionally delete some elements and check if the array remains increasing 
// after each insertion and deletion
// Note: added concurrently add simulation
function testGeneratePositionBetween(numberOfElements: number): void {
  const NUMBER_OF_SITE_ID = 5;
  const MAX_NUM_CONCURRENTLY_INSERT_AT_SAME_SPOT = 3; // Besides the 'main' element, add some more to the same spot

  const notDeleteRate = (numberOfElements > 10) ? (numberOfElements / 10) : 10; // The bigger, the less deletion
  let numError = 0;
  let totalDeleted = 0;
  let clock = 1;
  const arr = new Array<CRDTId>();
  const beginCRDTId = new CRDTId([new Identifier(1, 0)], clock++);
  const endCRDTId = new CRDTId([new Identifier(CustomNumber.BASE - 1, 0)], clock++)
  arr.push(beginCRDTId);
  arr.push(endCRDTId);

  for (let i = 0; i < numberOfElements; i++) {
    // random index except 0 and arr.length. This randomIndex will be the index of the newly inserted element
    const randomIndex = Math.floor(Math.random() * (arr.length - 1)) + 1;
    const numConcurrentlyInsertAtSameSpot = Math.floor(Math.random() * MAX_NUM_CONCURRENTLY_INSERT_AT_SAME_SPOT);
    const siteId = Math.floor(Math.random() * NUMBER_OF_SITE_ID) + 1;
    const newCRDTIds: CRDTId[] = [];
    const newCRDTId = CRDTId.generatePositionBetween(arr[randomIndex - 1], arr[randomIndex], siteId, clock++);
    newCRDTIds.push(newCRDTId); // will insert 1 elements

    // And this much elements 'concurrently' at the same spot
    for (let j = 1; j < numConcurrentlyInsertAtSameSpot; j++) {
      const concurrentCRDTId = CRDTId.deepCopy(newCRDTId);
      concurrentCRDTId.arr[concurrentCRDTId.arr.length - 1].siteId += j;  // insert at same spot, but bigger siteId
      newCRDTIds.push(concurrentCRDTId);
    }

    for (let j = 0; j < newCRDTIds.length; j++) {
      arr.splice(randomIndex + j, 0, newCRDTIds[j]);  // insert new elements between randomIndex-1 and randomIndex
    }
    
    if (!isCRDTIdArrayIncreasing(arr)) {
      console.error('ERROR: testGeneratePositionBetween() array is not increasing');
      numError++;
    }

    if (arr.length >= 3 && Math.random() < 0.2) { // Occasionally delete
      const start = 1 + Math.floor(Math.random() * (arr.length - 2)); // except 0 and arr.length-1
      const numDelete = Math.floor(Math.random() * (arr.length - start) / notDeleteRate); // Don't delete too much
      totalDeleted += numDelete;
      arr.splice(start, numDelete);
    }

    if (!isCRDTIdArrayIncreasing(arr)) {
      console.error('ERROR: testGeneratePositionBetween() array is not increasing');
      numError++;
    }
  }

  console.log('Tested CRDT.generatePositionBetween() by randomly inserting ' + numberOfElements
    + ' elements, and deleting ' + totalDeleted + ' elements. ' + numError + ' errors found');
}

function isCRDTIdArrayIncreasing(arr: CRDTId[]): boolean {
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i].compareTo(arr[i + 1]) >= 0) { // if arr[i] >= arr[i+1]
      return false;
    }
  }
  return true;
}

function printCRDTIdArray(arr: CRDTId[]): void {
  console.log('---------------Start---------------');
  for (let i = 0; i < arr.length; i++) {
    console.log(arr[i].toString());
  }
  console.log('---------------End---------------');
}


// Don't choose numberOfTestCases too big
// We check isCRDTIdArrayIncreasing after EVERY iteration
testGeneratePositionBetween(10000);
