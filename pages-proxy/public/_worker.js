// Forward every request to the Virm app Worker (bound as APP in wrangler.jsonc).
export default {
  fetch(request, env) {
    return env.APP.fetch(request);
  },
};
