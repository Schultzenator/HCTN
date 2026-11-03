import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { HttpMetaClient } from "../meta-client.js";

test("HTTP adapter uses the documented Responses and Images endpoints", async () => {
  const requests: Array<{ path: string; body: string; authorization: string | undefined }> = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      requests.push({ path: request.url ?? "", body, authorization: request.headers.authorization });
      response.setHeader("content-type", "application/json");
      if (request.url === "/responses") {
        response.end(JSON.stringify({ output_text: "ok" }));
      } else {
        response.end(JSON.stringify({ data: [{ b64_json: "ZmFrZQ==" }] }));
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  try {
    const client = new HttpMetaClient({ apiKey: "test-key", baseUrl: `http://127.0.0.1:${address.port}`, forceMock: false });
    await client.respond("muse-spark-1.3", "hello");
    assert.equal(await client.generateImage("a calm kitchen"), "data:image/png;base64,ZmFrZQ==");
    assert.deepEqual(requests.map(request => request.path), ["/responses", "/images/generations"]);
    assert.ok(requests.every(request => request.authorization === "Bearer test-key"));
    assert.equal(JSON.parse(requests[0]!.body).model, "muse-spark-1.3");
    assert.equal(JSON.parse(requests[1]!.body).model, "muse-image-1.0");
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
