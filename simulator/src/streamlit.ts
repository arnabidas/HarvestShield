// Keep standalone hosting intact; use Streamlit's component channel when embedded.
type Rpc = {id: string; method: string; path: string; body: unknown};
type Reply = {id: string; status: number; body: unknown};
const send = (type: string, data: Record<string, unknown> = {}) =>
  window.parent.postMessage({isStreamlitMessage: true, type, ...data}, '*');

export function mountInStreamlit(mount: () => void) {
  if (!new URLSearchParams(location.search).has('streamlitUrl')) { mount(); return; }
  const originalFetch = window.fetch.bind(window);
  const pending = new Map<string, {request: Rpc; resolve: (r: Response) => void; reject: (e: unknown) => void}>();
  let active: string | null = null;
  let mounted = false;
  const pump = () => {
    if (active || !pending.size) return;
    active = pending.keys().next().value!;
    send('streamlit:setComponentValue', {value: pending.get(active)!.request, dataType: 'json'});
  };
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.startsWith('/api/')) return originalFetch(input, init);
    return new Promise<Response>((resolve, reject) => {
      const id = crypto.randomUUID();
      const signal = init?.signal;
      if (signal?.aborted) { reject(signal.reason); return; }
      let body: unknown = null;
      try { if (init?.body) body = JSON.parse(String(init.body)); }
      catch (e) { reject(e); return; }
      pending.set(id, {request: {id, method: init?.method ?? 'GET', path: url, body}, resolve, reject});
      signal?.addEventListener('abort', () => {
        pending.delete(id);
        if (active === id) active = null;
        reject(signal.reason);
        pump();
      }, {once: true});
      pump();
    });
  };
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.data?.type !== 'streamlit:render') return;
    const reply: Reply | undefined = event.data.args?.reply;
    if (reply && pending.has(reply.id)) {
      pending.get(reply.id)!.resolve(new Response(JSON.stringify(reply.body), {
        status: reply.status, headers: {'Content-Type': 'application/json'},
      }));
      pending.delete(reply.id);
      if (active === reply.id) active = null;
      pump();
    }
    if (!mounted) {
      mounted = true;
      mount();
      const resize = () => send('streamlit:setFrameHeight', {height: Math.max(1000, document.body.scrollHeight)});
      new ResizeObserver(resize).observe(document.body);
      resize();
    }
  });
  send('streamlit:componentReady', {apiVersion: 1});
}
