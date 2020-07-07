import { Injectable } from '@angular/core';
import { CRDT } from '../shared/CRDT';

@Injectable({
  providedIn: 'root',
})
export class MessageTrackerService {
  private latestInsertClockVal: Map<number, number>;
  private insertNotReceived: Map<number, Set<number>>; // Map<siteId, clockValues>
  private toDeleteBuffer: Map<{ siteId: number; clockValue: number }, CRDT>; 
  private readyToDelete: CRDT[];

  constructor() {}

  // TODO: When new user join room --> add to the 3 above map
  trackNewPeer(siteId: number) {
    this.latestInsertClockVal.set(siteId, 0);
    this.insertNotReceived.set(siteId, new Set([]));
  }

  receiveRemoteInserts(crdts: CRDT[]) {
    for (let i = 0; i < crdts.length; i++) {
      const crdtIdArr = crdts[i].id.arr;
      const siteId = crdtIdArr[crdtIdArr.length - 1].siteId;
      const crdtClockVal = crdts[i].id.clockValue;

      if (crdtClockVal > this.latestInsertClockVal[siteId]) {
        for (
          let val = this.latestInsertClockVal[siteId] + 1;
          val < crdtClockVal;
          val++
        ) {
          this.insertNotReceived[siteId].add(val);
          if (
            this.toDeleteBuffer.has({
              siteId: siteId,
              clockValue: crdtClockVal,
            })
          ) {
            this.readyToDelete.push(crdts[i]);
            this.toDeleteBuffer.delete({
              siteId: siteId,
              clockValue: crdtClockVal,
            });
          }
        }

        this.latestInsertClockVal[siteId] = crdtClockVal;
      } else {
        this.insertNotReceived[siteId].delete(crdtClockVal);
        if (
          this.toDeleteBuffer.has({ siteId: siteId, clockValue: crdtClockVal })
        ) {
          this.readyToDelete.push(crdts[i]);
          this.toDeleteBuffer.delete({
            siteId: siteId,
            clockValue: crdtClockVal,
          });
        }
      }
    }
  }

  receiveRemoteRemoves(crdts: CRDT[]) {
    for (let i = 0; i < crdts.length; i++) {
      const crdtIdArr = crdts[i].id.arr;
      const siteId = crdtIdArr[crdtIdArr.length - 1].siteId;
      const crdtClockVal = crdts[i].id.clockValue;

      if (crdtClockVal > this.latestInsertClockVal[siteId]) {
        // delete sth that hasn't received insert
        this.toDeleteBuffer.set(
          { siteId: siteId, clockValue: crdtClockVal },
          crdts[i]
        );
      } else {
        if (this.insertNotReceived[siteId].has(crdtClockVal)) {
          // delete sth that hasn't received insert
          this.toDeleteBuffer.set(
            { siteId: siteId, clockValue: crdtClockVal },
            crdts[i]
          );
        }
      }
    }
  }

  getReadyToDeleteCrdt(): CRDT[] {
    return this.readyToDelete;
  }
}
