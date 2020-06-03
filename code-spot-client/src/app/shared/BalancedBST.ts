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
          const indexToReturn = this.getIndex(node.left.data);
          this.goUpRebalanceAndUpdateHeightBFAndSubtreeSize(node);
          return indexToReturn;
        } else {
          node = node.left;
        }
      } else {
        // Go right
        if (node.right === null) {
          node.right = new Node<T>(data, node);
          this.incrementAllAncestorsSize(node.right);
          const indexToReturn = this.getIndex(node.right.data);
          this.goUpRebalanceAndUpdateHeightBFAndSubtreeSize(node);
          return indexToReturn;
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
        this.goUpRebalanceAndUpdateHeightBFAndSubtreeSize(parent);
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
          this.goUpRebalanceAndUpdateHeightBFAndSubtreeSize(parent);
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
          this.goUpRebalanceAndUpdateHeightBFAndSubtreeSize(parent);
        }
      }
    }
  }

  private find(data: T): Node<T> {
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
    if (this.isEmpty()) {
      return -1;
    }
    let node = this.root;
    let index = 0;
    while (node) {
      if (data.compareTo(node.data) === 0) {
        // subtree of a leaf has size 0. subtree of null has size -1
        const leftSubtreeSize = node.left ? node.left.subtreeSize : -1;
        index += leftSubtreeSize + 1;
        return index;
      } else if (data.compareTo(node.data) < 0) {
        node = node.left;
      } else {
        const leftSubtreeSize = node.left ? node.left.subtreeSize : -1;
        index += leftSubtreeSize + 2;
        node = node.right;
      }
    }
    // Not found
    return -1;
  }

  getDataAt(index: number): T {
    if (this.isEmpty() || index >= this.size) {
      return null;
    }

    let node = this.root;
    while (node) {
      const leftSubtreeSize = node.left ? node.left.subtreeSize : -1;
      if (index === leftSubtreeSize + 1) {
        return node.data;
      } else if (index <= leftSubtreeSize) {
        node = node.left;
      } else {
        index -= leftSubtreeSize + 2;
        node = node.right;
      }
    }
    // Weird. Something went wrong
    throw new Error('Something went wrong when getDataAt(index)');
  }

  goUpRebalanceAndUpdateHeightBFAndSubtreeSize(node: Node<T>): void {
    this.updateHeightBFAndSubtreeSize(node);

    const nodeIsRoot = node === this.root;

    // Rotate if needed

    // 1.Right heavy: Either RR or RL
    if (node.balancedFactor === 2) {
      // Must be RR
      if (node.bfRight() >= 0) {
        node = this.leftRotate(node);
      } else {
        // Must be RL
        this.rightRotate(node.right);
        node = this.leftRotate(node);
      }
    }
    // 2.Left heavy: Either LL or LR
    else if (node.balancedFactor === -2) {
      // Must be LL
      if (node.bfLeft() <= 0) {
        node = this.rightRotate(node);
      } else {
        this.leftRotate(node.left);
        node = this.rightRotate(node);
      }
    }

    // If we've reached the root
    if (nodeIsRoot) {
      this.root = node;
      this.updateHeightBFAndSubtreeSize(this.root);
      return;
    } else {
      // Go up and fix parent node
      this.goUpRebalanceAndUpdateHeightBFAndSubtreeSize(node.parent);
    }
  }

  updateHeightBFAndSubtreeSize(node: Node<T>): void {
    node.height = Math.max(node.heightLeft(), node.heightRight()) + 1;
    node.balancedFactor = node.heightRight() - node.heightLeft();
    node.subtreeSize = node.subtreeSizeLeft() + node.subtreeSizeRight() + 2;
  }

  leftRotate(node: Node<T>): Node<T> {
    const nodeParent = node.parent;
    const x = node;
    const y = node.right;

    x.right = y.left;
    if (y.left) {
      y.left.parent = x;
    }

    x.parent = y;
    y.left = x;

    y.parent = nodeParent;
    if (nodeParent) {
      if (nodeParent.left === x) {
        nodeParent.left = y;
      } else {
        nodeParent.right = y;
      }
    }

    this.updateHeightBFAndSubtreeSize(x);
    this.updateHeightBFAndSubtreeSize(y);

    return y;
  }

  rightRotate(node: Node<T>): Node<T> {
    const nodeParent = node.parent;
    const x = node;
    const y = node.left;

    x.left = y.right;
    if (y.right) {
      y.right.parent = x;
    }

    y.right = x;
    x.parent = y;

    y.parent = nodeParent;
    if (nodeParent) {
      if (nodeParent.left === x) {
        nodeParent.left = y;
      } else {
        nodeParent.right = y;
      }
    }

    this.updateHeightBFAndSubtreeSize(x);
    this.updateHeightBFAndSubtreeSize(y);

    return y;
  }

  isBalance(): boolean {
    const maximumHeight = Math.ceil(Math.log2(this.size)) + 1;
    return this.getHeight() <= maximumHeight;
  }

  // Note: I can simply get height from this.root.height,
  // but I want to calculate everything again to see if they confirm each other
  getHeight(): number {
    if (this.isEmpty()) {
      return 0;
    }
    return this.findMaximumDepth(this.root);
  }

  private findMaximumDepth(node: Node<T>): number {
    if (!node) {
      return -1;
    }
    return (
      Math.max(
        this.findMaximumDepth(node.left),
        this.findMaximumDepth(node.right)
      ) + 1
    );
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
  height: number;
  balancedFactor: number;
  constructor(data: T, parent: Node<T>) {
    this.data = data;
    this.left = null;
    this.right = null;
    this.parent = parent;
    this.subtreeSize = 0;
    this.height = 0;
    this.balancedFactor = 0;
  }

  heightLeft(): number {
    return this.left ? this.left.height : -1;
  }

  heightRight(): number {
    return this.right ? this.right.height : -1;
  }

  bfLeft(): number {
    return this.left ? this.left.balancedFactor : 0;
  }

  bfRight(): number {
    return this.right ? this.right.balancedFactor : 0;
  }

  subtreeSizeLeft(): number {
    return this.left ? this.left.subtreeSize : -1;
  }

  subtreeSizeRight(): number {
    return this.right ? this.right.subtreeSize : -1;
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
