import { BalancedBST } from './BalancedBST';

class Integer {
    num: number;
    constructor(n: number) {
        this.num = n;
    }
    compareTo(other: Integer): number {
        return this.num - other.num;
    }
    toString() {
        return '' + this.num;
    }
}

const bst = new BalancedBST<Integer>();
bst.insert(new Integer(8));
bst.insert(new Integer(5));
bst.insert(new Integer(10));
bst.insert(new Integer(7));
bst.insert(new Integer(9));
bst.printLevel();

