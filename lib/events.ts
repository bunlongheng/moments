/**
 * In-process pub/sub used to push "photos/style changed" to all connected
 * displays over SSE. Single Node process (next start) shares this module.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribe(l: Listener) {
    listeners.add(l);
}

export function unsubscribe(l: Listener) {
    listeners.delete(l);
}

export function publish() {
    for (const l of listeners) {
        try {
            l();
        } catch {
            // a dead connection shouldn't break the others
        }
    }
}

export function listenerCount() {
    return listeners.size;
}
