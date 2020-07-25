import { Injectable } from '@angular/core';
import { CRDT } from '../shared/CRDT';
import { PeerUtils } from '../shared/Utils';
import { AnnounceType } from '../shared/AnnounceType';

@Injectable({
  providedIn: 'root',
})
/**
 * The purpose of this class is to receive all CRDT batches before processing them.
 * We thought this might speed up the program because inserting / deleting 1 million chars
 * once on Monaco is faster than inserting / deleting 1000 chars 1000 times.
 *
 * Turns out, processing each CRDT batch right away is just as fast (maybe even faster),
 * and the upside is the user can see the program making progress. That why we don't use this class anymore.
 * (but still keep it for future reference)
 */
export class CrdtPackageService {
  crdtsReady: CRDT[];
  requestType: PackageType;
  private crdtPackages: CrdtPackage[] = [];

  takeCRDTBatch(
    crdts: CRDT[],
    fromPeerId: string,
    packageId: number,
    packageType: PackageType,
    totalBatches: number,
    batchNumber: number
  ): void {
    let index = this.crdtPackages.findIndex(
      (p) => p.fromPeerId === fromPeerId && p.packageId === packageId
    );
    if (index === -1) {
      const newPackage = new CrdtPackage(
        packageId,
        fromPeerId,
        packageType,
        totalBatches
      );
      this.crdtPackages.push(newPackage);
      index = this.crdtPackages.length - 1;
      console.log('New CRDT package');
    }
    this.crdtPackages[index].addNewBatch(batchNumber, crdts);
    if (this.crdtPackages[index].hasReceiveAllBatches()) {
      this.crdtsReady = this.crdtPackages[index].toCRDTArray();
      console.log('CRDT package complete: ');
      this.requestType = this.crdtPackages[index].packageType;
      PeerUtils.announceInfo(AnnounceType.CrdtPackageReady);
      this.crdtPackages.splice(index, 1);
    }
  }
}

// packageId alone is not unique but (packageId, peerId) is
class CrdtPackage {
  packageId: number;
  fromPeerId: string;
  packageType: PackageType;
  totalBatches: number;
  crdtBatches: CrdtBatch[];
  batchesLeft: number;
  constructor(
    packageId: number,
    fromPeerId: string,
    packageType: PackageType,
    totalBatches: number
  ) {
    this.packageId = packageId;
    this.fromPeerId = fromPeerId;
    this.packageType = packageType;
    this.totalBatches = totalBatches;
    this.crdtBatches = new Array<CrdtBatch>(totalBatches);
    this.batchesLeft = totalBatches;
  }
  addNewBatch(batchNumber: number, crdts: CRDT[]): void {
    if (!this.crdtBatches[batchNumber]) {
      this.crdtBatches[batchNumber] = new CrdtBatch(crdts);
      this.batchesLeft--;
    }
  }
  hasReceiveAllBatches(): boolean {
    return this.batchesLeft === 0;
  }
  toCRDTArray(): CRDT[] {
    const arr = new Array<CRDT>();
    for (let i = 0; i < this.crdtBatches.length; i++) {
      const curBatch = this.crdtBatches[i];
      for (let j = 0; j < curBatch.crdts.length; j++) {
        arr.push(curBatch.crdts[j]);
      }
    }
    return arr;
  }
}

class CrdtBatch {
  crdts: CRDT[];
  constructor(crdts: CRDT[]) {
    this.crdts = crdts;
  }
}

export const enum PackageType {
  RemoteInsert = 0,
  RemoteRemove = 1,
  OldCRDTs = 2,
}
