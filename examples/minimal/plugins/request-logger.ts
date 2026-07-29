import { definePlugin } from "../../../src/index.js";

/**
 * A cross-cutting plugin: times every interaction and logs it. Plugins register
 * middleware and hooks through the `app` façade - they never patch the core.
 *
 * Wire it up in defineBot({ plugins: [requestLogger] }).
 */
export const requestLogger = definePlugin({
  name: "request-logger",
  version: "1.0.0",
  setup(app) {
    app.hooks.beforeInteraction(async (ctx, next) => {
      const started = Date.now();
      await next();
      ctx.logger.info({ ms: Date.now() - started, type: ctx.interaction.type }, "interaction handled");
    });
    app.logger.info({}, "request-logger ready");
  },
});
