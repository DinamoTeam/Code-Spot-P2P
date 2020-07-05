import { Injectable } from '@angular/core';
import { CRDT } from '../shared/CRDT';

@Injectable({
  providedIn: 'root'
})
export class MessageTrackerService {
  private latestClockVal: Map<number, number>;
  private hasNotReceived: Map<number, number[]>;
  private deleteBuffer: Map<number, CRDT[]>;


  constructor() { }

  // TODO: When new user join room --> add to the 3 above map

  receiveRemoteInserts(crdts: CRDT[]) {
    this.updateHasNotReceived(crdts);


    // TODO: see which CRDTs in deleteBuffer are ready to be deleted
    // TODO: emit event to code - editor.component, code - editor.component calls
    //editorService.handleRemoteInsert() 
  }

  receiveRemoteRemoves(crdts: CRDT[]) {
    this.updateHasNotReceived(crdts);
    // TODO: call editorService.handleRemoteRemove(CRDT[])
  }

  processDeleteBuffer() {
    // Delete 'ready' characters
  }

  private updateHasNotReceived(crdts: CRDT[]) {
    for (let i = 0; i < crdts.length; i++) {
      let siteId = 0

      let crdtClockVal = crdts[i].id.clockValue;

      if (crdtClockVal > this.latestClockVal[siteId]) {
        if (this.latestClockVal[siteId] - crdtClockVal === 1)
          this.latestClockVal[siteId] = crdtClockVal;
        else {
          for (let val = this.latestClockVal[siteId] + 1; val < crdtClockVal; val++) {
            this.hasNotReceived[siteId].push(val);
          }
        }
      }
    }
  }
}

