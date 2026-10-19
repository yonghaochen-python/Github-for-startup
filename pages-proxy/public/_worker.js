// Forward every request to the Virm app Worker (bound as APP in wrangler.jsonc).
const forwarder = {
  fetch(request, env) {
    return env.APP.fetch(request);
  },
};

export default forwarder;
