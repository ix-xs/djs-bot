import { defineService } from "../../../../src/index.js";

/** A tiny in-memory ticket store, exposed as an injectable service. */
export const TicketsService = defineService("tickets", {
  factory: () => {
    const open = new Set<string>();
    return {
      open(id: string) {
        open.add(id);
      },
      close(id: string) {
        return open.delete(id);
      },
      isOpen(id: string) {
        return open.has(id);
      },
    };
  },
});

// Augment the service map so `ctx.services.tickets` is fully typed everywhere.
declare module "../../../../src/index.js" {
  interface ServiceMap {
    tickets: {
      open(id: string): void;
      close(id: string): boolean;
      isOpen(id: string): boolean;
    };
  }
}
