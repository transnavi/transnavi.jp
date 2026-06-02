export interface Env {
  ASSETS: Fetcher;
}

export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
