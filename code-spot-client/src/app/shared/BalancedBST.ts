export interface Comparable {
  compareTo: (other: any) => number;
}

export class BalancedBST<T extends Comparable> {
  private root: Node<T>;
  private size: number;
  constructor() {
    this.root = null;
    this.size = 0;
  }

  // Return inserted 'index'
  insert(data: T): number {
    if (this.isEmpty()) {
      this.root = new Node<T>(data, null);
      this.size++;
      return 0;
    }

    this.size++;
    let node = this.root;
    while (true) {
      if (data.compareTo(node.data) === 0) {
        throw new Error('This BST does not allow duplicate elements');
      } else if (data.compareTo(node.data) < 0) {
        // Go left
        if (node.left === null) {
          node.left = new Node<T>(data, node);
          this.incrementAllAncestorsSize(node.left);
          return this.getIndex(node.left.data);
        } else {
          node = node.left;
        }
      } else {
        // Go right
        if (node.right === null) {
          node.right = new Node<T>(data, node);
          this.incrementAllAncestorsSize(node.right);
          return this.getIndex(node.right.data);
        } else {
          node = node.right;
        }
      }
    }
  }

  remove(data: T): number {
    // TODO
    return 0;
  }

  getSize(): number {
    return this.size;
  }

  isEmpty(): boolean {
    if ((this.size === 0) !== (this.root === null)) {
      throw new Error('Tree size and root value are not on the same page!');
    }
    return this.size === 0;
  }

  getIndex(data: T): number {
    // TODO
    return 0;
  }

  getDataAt(index: number): T {
    // TODO
    return null;
  }

  printLevel(): void {
    if (this.isEmpty()) {
      return;
    }
    let res = '';
    const q = new Queue<Node<T>>();
    q.enqueue(this.root);
    while (!q.isEmpty()) {
      const node = q.dequeue();
      res = res + node.data.toString() + '(Size:' + node.subtreeSize + ') ';
      if (node.left !== null) {
        q.enqueue(node.left);
      }
      if (node.right !== null) {
        q.enqueue(node.right);
      }
    }
    console.log('Print level by level: ' + res);
  }

  private incrementAllAncestorsSize(node: Node<T>): void {
    if (node === null) {
      throw new Error(
        'Error: You should not call incrementAllAncestorsSize on a null node'
      );
    }
    while (node.parent !== null) {
      node = node.parent;
      node.subtreeSize++;
    }
  }
}

class Node<T> {
  data: T;
  subtreeSize: number;
  left: Node<T>;
  right: Node<T>;
  parent: Node<T>;
  constructor(
    data: T,
    parent: Node<T> = null,
    left: Node<T> = null,
    right: Node<T> = null,
    subtreeSize: number = 0
  ) {
    this.data = data;
    this.left = left;
    this.right = right;
    this.parent = parent;
    this.subtreeSize = subtreeSize;
  }
}

// A naive implementation of Queue
class Queue<T> {
  private list: T[];
  constructor() {
    this.list = new Array<T>();
  }
  isEmpty(): boolean {
    return this.list.length === 0;
  }
  enqueue(data: T): void {
    this.list.push(data);
  }
  dequeue(): T {
    if (this.isEmpty()) {
      throw new Error('The queue is empty!');
    }
    return this.list.shift();
  }
}
