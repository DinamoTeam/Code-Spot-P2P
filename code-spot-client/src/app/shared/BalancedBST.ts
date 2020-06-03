export interface IsObject {
  compareTo: (other: this) => number;
  toString: () => string;
}

// NO DUPLICATES in this BST! return -1 if insert duplicate elements
export class BalancedBST<T extends IsObject> {
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
        // No duplicate elements
        return -1;
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
    const nodeToRemove = this.find(data);
    if (!nodeToRemove) {
      return -1;
    }
    const returnIndex = this.getIndex(data);
    this.size--;
    this.removeHelper(nodeToRemove);
    return returnIndex;
  }

  private removeHelper(nodeToRemove: Node<T>) {
    // if nodeToRemove is a leaf
    if (!nodeToRemove.left && !nodeToRemove.right) {
      // and it is also the root
      if (!nodeToRemove.parent) {
        this.root = null;
      } else {
        this.decrementAllAncestorsSize(nodeToRemove);
        const parent = nodeToRemove.parent;
        if (parent.left === nodeToRemove) {
          parent.left = null;
        } else {
          parent.right = null;
        }
      }
    } else if (nodeToRemove.left && nodeToRemove.right) {
      // If has 2 children
      // Find left most node in right subtree
      let temp = nodeToRemove.right;
      while (temp.left) {
        temp = temp.left;
      }
      // temp is the left most node
      nodeToRemove.data = temp.data;
      this.removeHelper(temp);
    } else {
      // It has 1 children
      const parent = nodeToRemove.parent;
      // If that is left child
      if (nodeToRemove.left) {
        // If nodeToRemove is the root
        if (!parent) {
          nodeToRemove.left.parent = null;
          this.root = nodeToRemove.left;
        } else {
          this.decrementAllAncestorsSize(nodeToRemove);
          if (parent.left === nodeToRemove) {
            parent.left = nodeToRemove.left;
            nodeToRemove.left.parent = parent;
          } else {
            parent.right = nodeToRemove.left;
            nodeToRemove.left.parent = parent;
          }
        }
      } else {
        // It has right child
        // If nodeToRemove is the root
        if (!parent) {
          nodeToRemove.right.parent = null;
          this.root = nodeToRemove.right;
        } else {
          this.decrementAllAncestorsSize(nodeToRemove);
          if (parent.left === nodeToRemove) {
            parent.left = nodeToRemove.right;
            nodeToRemove.right.parent = parent;
          } else {
            parent.right = nodeToRemove.right;
            nodeToRemove.right.parent = parent;
          }
        }
      }
    }
  }

  find(data: T): Node<T> {
    if (this.isEmpty()) {
      return null;
    }
    let node = this.root;
    while (node) {
      if (data.compareTo(node.data) === 0) {
        return node;
      } else if (data.compareTo(node.data) < 0) {
        node = node.left;
      } else {
        node = node.right;
      }
    }
    // Not found
    return null;
  }

  getIndex(data: T): number {
    // TODO
    return 0;
  }

  getDataAt(index: number): T {
    // TODO
    return null;
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

  inorderToString(): string {
    const res: string[] = [];
    this.inorderHelper(this.root, res);
    let stringRes = '';
    for (let i = 0; i < res.length; i++) {
      stringRes = stringRes + res[i];
    }
    return stringRes;
  }

  private inorderHelper(node: Node<T>, res: string[]): void {
    if (!node) {
      return;
    }
    this.inorderHelper(node.left, res);
    res.push(node.data.toString());
    this.inorderHelper(node.right, res);
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

  private decrementAllAncestorsSize(node: Node<T>): void {
    if (node === null) {
      throw new Error(
        'Error: You should not call incrementAllAncestorsSize on a null node'
      );
    }
    while (node.parent !== null) {
      node = node.parent;
      node.subtreeSize--;
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
    parent: Node<T>
  ) {
    this.data = data;
    this.left = null;
    this.right = null;
    this.parent = parent;
    this.subtreeSize = 0;
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
