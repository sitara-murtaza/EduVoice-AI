import { GET, PATCH, POST } from "./route";

export default {
  fetch(request: Request) {
    const pathname = new URL(request.url).pathname;
    if (!pathname.startsWith("/api/")) {
      return Response.json({ error: "Endpoint not found." }, { status: 404 });
    }
    const path = pathname.slice("/api/".length).split("/");
    const handler = request.method === "GET" ? GET : request.method === "POST" ? POST : request.method === "PATCH" ? PATCH : null;
    if (!handler) return Response.json({ error: "Method not allowed." }, { status: 405 });
    return handler(request, { params: Promise.resolve({ path }) });
  },
};
