import { Injectable } from '@angular/core';
import { CRDT } from '../shared/CRDT';
import { PeerUtils } from '../shared/Utils';
import { BroadcastInfo } from '../shared/BroadcastInfo';

@Injectable({
  providedIn: 'root',
})
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
      PeerUtils.broadcastInfo(BroadcastInfo.CrdtPackageReady);
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
