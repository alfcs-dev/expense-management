import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { fromNodeHeaders } from "better-auth/node";
import {
  fastifyTRPCPlugin,
  type FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import {
  appRouter,
  createContext,
  type AppRouter,
  type User,
} from "@expense-management/trpc";
import { auth } from "./auth";
import { getCorsOrigin } from "./env";

type AuthSessionUser = typeof auth.$Infer.Session.user;

function toTRPCUser(user: AuthSessionUser): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
  };
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
    routerOptions: {
      maxParamLength: 5000,
    },
  });

  await app.register(cors, {
    origin: getCorsOrigin(),
    credentials: true,
  });

  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = new Headers();

      Object.entries(request.headers).forEach(([key, value]) => {
        if (value === undefined) {
          return;
        }
        if (Array.isArray(value)) {
          value.forEach((entry) => headers.append(key, entry));
          return;
        }
        headers.set(key, String(value));
      });

      const body =
        request.body == null
          ? undefined
          : typeof request.body === "string"
            ? request.body
            : Buffer.isBuffer(request.body)
              ? request.body
              : JSON.stringify(request.body);

      const authRequest = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(body !== undefined ? { body } : {}),
      });

      const response = await auth.handler(authRequest);
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });
      const responseBody = await response.text();
      reply.send(responseBody.length > 0 ? responseBody : null);
    },
  });

  await app.register(fastifyTRPCPlugin, {
    prefix: "/api/trpc",
    trpcOptions: {
      router: appRouter,
      createContext: async ({ req, res }) => {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(req.headers),
        });

        return createContext({
          req,
          res,
          user: session?.user ? toTRPCUser(session.user) : null,
        });
      },
      onError({ path, error }) {
        app.log.error({ path, error }, "tRPC error");
      },
    } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
  });

  app.get("/health", async (_request, reply) => {
    return reply.status(200).send({ status: "ok" });
  });

  return app;
}
