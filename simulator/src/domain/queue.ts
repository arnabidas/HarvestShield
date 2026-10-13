// Stable binary min-heap; virtual time and insertion sequence define order.
export class Queue<T extends {at:number;order:number}> {
  private heap:T[]=[];
  get size(){return this.heap.length;}
  peek(){return this.heap[0];}
  push(value:T) {this.heap.push(value);let n=this.heap.length-1;while(n>0){const p=(n-1)>>1;if(!this.less(this.heap[n],this.heap[p]))break;[this.heap[n],this.heap[p]]=[this.heap[p],this.heap[n]];n=p;}}
  pop():T|undefined {if(!this.heap.length)return;const result=this.heap[0];const tail=this.heap.pop()!;if(this.heap.length){this.heap[0]=tail;let n=0;while(true){const l=n*2+1,r=l+1;let m=n;if(l<this.heap.length&&this.less(this.heap[l],this.heap[m]))m=l;if(r<this.heap.length&&this.less(this.heap[r],this.heap[m]))m=r;if(m===n)break;[this.heap[n],this.heap[m]]=[this.heap[m],this.heap[n]];n=m;}}return result;}
  private less(a:T,b:T){return a.at<b.at||(a.at===b.at&&a.order<b.order);}
}
export function seeded(seed:number){let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
export function hash(value:unknown){let h=2166136261;for(const c of JSON.stringify(value)){h=Math.imul(h^c.charCodeAt(0),16777619);}return (h>>>0).toString(16).padStart(8,'0');}
