// Stands in for planary-casino-api when the table runs locally (`npm run play:local`).
// The table reaches the casino through a service binding, worker to worker, so this has to be a
// worker of that name; it hands every call on to the play-local script, which keeps the wallets.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    return fetch(`${env.LOCAL_API}${url.pathname}${url.search}`, {
      method: request.method,
      headers: request.headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
    });
  },
};
