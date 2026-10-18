// SurrealDB (3.0.1, SurrealKV) can commit two concurrent transactions that
// both write the same record or unique index entry, so a check-then-write
// query can still race itself. The Site runs as one process, so queuing the
// writes here is enough.

const queues = new Map<string, Promise<unknown>>()

/** Runs tasks with the same name one after another, in the order they came */
export default function oneAtATime<T>(name: string, task: () => Promise<T>) {
	const run = (queues.get(name) || Promise.resolve()).then(task)
	const tail = run.then(
		() => {},
		() => {}
	)
	queues.set(name, tail)
	tail.then(() => {
		if (queues.get(name) === tail) queues.delete(name)
	})
	return run
}
