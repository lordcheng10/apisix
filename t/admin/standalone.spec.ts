/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import axios from "axios";
import YAML from "yaml";

const ENDPOINT = "/apisix/admin/configs";
const config1 = {
  routes: [
    {
      id: "r1",
      uri: "/r1",
      upstream: {
        nodes: { "127.0.0.1:1980": 1 },
        type: "roundrobin",
      },
      plugins: { "proxy-rewrite": { uri: "/hello" } },
    },
  ],
};
const config2 = {
  routes: [
    {
      id: "r2",
      uri: "/r2",
      upstream: {
        nodes: { "127.0.0.1:1980": 1 },
        type: "roundrobin",
      },
      plugins: { "proxy-rewrite": { uri: "/hello" } },
    },
  ],
};
const invalidConfVersionConfig1 = {
  routes_conf_version: -1,
};
const invalidConfVersionConfig2 = {
  routes_conf_version: "adc",
};
const routeWithModifiedIndex = {
  routes: [
    {
      id: "r1",
      uri: "/r1",
      modifiedIndex: 1,
      upstream: {
        nodes: { "127.0.0.1:1980": 1 },
        type: "roundrobin",
      },
      plugins: { "proxy-rewrite": { uri: "/hello" } },
    },
  ],
};
const clientConfig = {
  baseURL: "http://localhost:1984",
  headers: {
    "X-API-KEY": "edd1c9f034335f136f87ad84b625c8f1",
  },
};

describe("Admin - Standalone", () => {
  const client = axios.create(clientConfig);
  client.interceptors.response.use((response) => {
    const contentType = response.headers["content-type"] || "";
    if (
      contentType.includes("application/yaml") &&
      typeof response.data === "string" &&
      response.config.responseType !== "text"
    )
      response.data = YAML.parse(response.data);
    return response;
  });

  describe("Normal", () => {
    it("dump empty config (default json format)", async () => {
      const resp = await client.get(ENDPOINT);
      expect(resp.status).toEqual(200);
      expect(resp.data.routes_conf_version).toEqual(0);
      expect(resp.data.ssls_conf_version).toEqual(0);
      expect(resp.data.services_conf_version).toEqual(0);
      expect(resp.data.upstreams_conf_version).toEqual(0);
      expect(resp.data.consumers_conf_version).toEqual(0);
    });

    it("dump empty config (yaml format)", async () => {
      const resp = await client.get(ENDPOINT, {
        headers: { Accept: "application/yaml" },
      });
      expect(resp.status).toEqual(200);
      expect(resp.headers["content-type"]).toEqual("application/yaml");
      expect(resp.data.routes_conf_version).toEqual(0);
      expect(resp.data.ssls_conf_version).toEqual(0);
      expect(resp.data.services_conf_version).toEqual(0);
      expect(resp.data.upstreams_conf_version).toEqual(0);
      expect(resp.data.consumers_conf_version).toEqual(0);
    });

    it("update config (add routes, by json)", async () => {
      const resp = await client.put(ENDPOINT, config1);
      expect(resp.status).toEqual(202);
    });

    it("dump config (json format)", async () => {
      const resp = await client.get(ENDPOINT);
      expect(resp.status).toEqual(200);
      expect(resp.data.routes_conf_version).toEqual(1);
      expect(resp.data.ssls_conf_version).toEqual(1);
      expect(resp.data.services_conf_version).toEqual(1);
      expect(resp.data.upstreams_conf_version).toEqual(1);
      expect(resp.data.consumers_conf_version).toEqual(1);
    });

    it("check default value", async () => {
      const resp = await client.get(ENDPOINT);
      expect(resp.status).toEqual(200);
      expect(resp.data.routes).toEqual(config1.routes);
    });

    it("dump config (yaml format)", async () => {
      const resp = await client.get(ENDPOINT, {
        headers: { Accept: "application/yaml" },
        responseType: 'text',
      });
      expect(resp.status).toEqual(200);
      expect(resp.data).toContain("routes:")
      expect(resp.data).toContain("id: r1")
      expect(resp.data.startsWith('---')).toBe(false);
      expect(resp.data.endsWith('...')).toBe(false);
    });

    it('check route "r1"', async () => {
      const resp = await client.get("/r1");
      expect(resp.status).toEqual(200);
      expect(resp.data).toEqual("hello world\n");
    });

    it("update config (add routes, by yaml)", async () => {
      const resp = await client.put(
        ENDPOINT,
        YAML.stringify(config2),
        {
          headers: { "Content-Type": "application/yaml" },
        }
      );
      expect(resp.status).toEqual(202);
    });

    it("dump config (json format)", async () => {
      const resp = await client.get(ENDPOINT);
      expect(resp.status).toEqual(200);
      expect(resp.data.routes_conf_version).toEqual(2);
      expect(resp.data.ssls_conf_version).toEqual(2);
      expect(resp.data.services_conf_version).toEqual(2);
      expect(resp.data.upstreams_conf_version).toEqual(2);
      expect(resp.data.consumers_conf_version).toEqual(2);
    });

    it('check route "r1"', () =>
      expect(client.get("/r1")).rejects.toThrow(
        "Request failed with status code 404"
      ));

    it('check route "r2"', async () => {
      const resp = await client.get("/r2");
      expect(resp.status).toEqual(200);
      expect(resp.data).toEqual("hello world\n");
    });

    it("update config (delete routes)", async () => {
      const resp = await client.put(
        ENDPOINT,
        {},
        { params: { conf_version: 3 } }
      );
      expect(resp.status).toEqual(202);
    });

    it('check route "r2"', () =>
      expect(client.get("/r2")).rejects.toThrow(
        "Request failed with status code 404"
    ));

    it("only set routes_conf_version", async () => {
      const resp = await client.put(
        ENDPOINT,
        YAML.stringify({ routes_conf_version: 15 }),
        {headers: {"Content-Type": "application/yaml"},
      });
      expect(resp.status).toEqual(202);

      const resp_1 = await client.get(ENDPOINT);
      expect(resp_1.status).toEqual(200);
      expect(resp_1.data.routes_conf_version).toEqual(15);
      expect(resp_1.data.ssls_conf_version).toEqual(4);
      expect(resp_1.data.services_conf_version).toEqual(4);
      expect(resp_1.data.upstreams_conf_version).toEqual(4);
      expect(resp_1.data.consumers_conf_version).toEqual(4);

      const resp2 = await client.put(
        ENDPOINT,
        YAML.stringify({ routes_conf_version: 17 }),
        {headers: {"Content-Type": "application/yaml"},
      });
      expect(resp2.status).toEqual(202);

      const resp2_1 = await client.get(ENDPOINT);
      expect(resp2_1.status).toEqual(200);
      expect(resp2_1.data.routes_conf_version).toEqual(17);
      expect(resp2_1.data.ssls_conf_version).toEqual(5);
      expect(resp2_1.data.services_conf_version).toEqual(5);
      expect(resp2_1.data.upstreams_conf_version).toEqual(5);
      expect(resp2_1.data.consumers_conf_version).toEqual(5);
    });

    it("control resource changes using modifiedIndex", async () => {
      const c1 = structuredClone(routeWithModifiedIndex);
      c1.routes[0].modifiedIndex = 1;

      const c2 = structuredClone(c1);
      c2.routes[0].uri = "/r2";

      const c3 = structuredClone(c2);
      c3.routes[0].modifiedIndex = 2;

      // Update with c1
      const resp = await client.put(ENDPOINT, c1);
      expect(resp.status).toEqual(202);

      // Check route /r1 exists
      const resp_1 = await client.get("/r1");
      expect(resp_1.status).toEqual(200);

      // Update with c2
      const resp2 = await client.put(ENDPOINT, c2);
      expect(resp2.status).toEqual(202);

      // Check route /r1 exists
      // But it is not applied because the modifiedIndex is the same as the old value
      const resp2_2 = await client.get("/r1");
      expect(resp2_2.status).toEqual(200);

      // Check route /r2 not exists
      const resp2_1 = await client.get("/r2").catch((err) => err.response);
      expect(resp2_1.status).toEqual(404);

      // Update with c3
      const resp3 = await client.put(ENDPOINT, c3);
      expect(resp3.status).toEqual(202);

      // Check route /r1 not exists
      const resp3_1 = await client.get("/r1").catch((err) => err.response);
      expect(resp3_1.status).toEqual(404);

      // Check route /r2 exists
      const resp3_2 = await client.get("/r2");
      expect(resp3_2.status).toEqual(200);
    });
  });

  describe("Exceptions", () => {
    const clientException = axios.create({
      ...clientConfig,
      validateStatus: () => true,
    });

    it("update config (lower conf_version)", async () => {
      const resp = await clientException.put(
        ENDPOINT,
        YAML.stringify(invalidConfVersionConfig1),
        {
          headers: {
            "Content-Type": "application/yaml",
          },
        }
      );
      expect(resp.status).toEqual(400);
      expect(resp.data).toEqual({
        error_msg:
          "routes_conf_version must be greater than or equal to (20)",
      });
    });

    it("update config (invalid conf_version)", async () => {
      const resp = await clientException.put(
        ENDPOINT,
        YAML.stringify(invalidConfVersionConfig2),
        {
          headers: {
            "Content-Type": "application/yaml",
          },
        }
      );
      expect(resp.status).toEqual(400);
      expect(resp.data).toEqual({
        error_msg: "routes_conf_version must be a number",
      });
    });

    it("update config (invalid json format)", async () => {
      const resp = await clientException.put(ENDPOINT, "{abcd", {
        params: { conf_version: 4 },
      });
      expect(resp.status).toEqual(400);
      expect(resp.data).toEqual({
        error_msg:
          "invalid request body: Expected object key string but found invalid token at character 2",
      });
    });

    it("update config (not compliant with jsonschema)", async () => {
      const data = structuredClone(config1);
      (data.routes[0].uri as unknown) = 123;
      const resp = await clientException.put(ENDPOINT, data);
      expect(resp.status).toEqual(400);
      expect(resp.data).toMatchObject({
        error_msg:
          'invalid routes at index 0, err: property "uri" validation failed: wrong type: expected string, got number',
      });
    });

    it("update config (empty request body)", async () => {
      const resp = await clientException.put(ENDPOINT, "");
      expect(resp.status).toEqual(400);
      expect(resp.data).toEqual({
        error_msg: "invalid request body: empty request body",
      });
    });
  });
});
