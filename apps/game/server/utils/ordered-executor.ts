export class OrderedPromiseExecutor {
  private busy = false;
  private readonly queue: [() => Promise<any>, (resolvedVal: any) => void, (err: any) => void][] =
    [];
  private dequeue() {
    if (this.busy) {
      return false;
    }
    const next = this.queue.shift();
    if (!next) {
      return false;
    }
    const [promiseFactory, resolvePromise, rejectPromise] = next;
    try {
      this.busy = true;
      promiseFactory()
        .then((value) => {
          this.busy = false;
          resolvePromise(value);
          this.dequeue();
        })
        .catch((err) => {
          this.busy = false;
          rejectPromise(err);
          this.dequeue();
        });
    } catch (err) {
      this.busy = false;
      rejectPromise(err);
      this.dequeue();
    }
    return true;
  }

  public enqueue<T extends () => Promise<any>>(factory: T): Promise<Awaited<ReturnType<T>>> {
    return new Promise<Awaited<ReturnType<T>>>((res, rej) => {
      this.queue.push([factory, res, rej]);
      this.dequeue();
    });
  }
}
