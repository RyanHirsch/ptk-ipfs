import ky from "ky";
import asyncRetry from "async-retry";
import { GENERAL_USER_AGENT, ONE_MINUTE } from "./helpers";
import { writeFile } from "fs/promises";
import { logger } from "./logger";

const ipfsHost = "http://127.0.0.1:5001/api/v0";

const IPFS_TIMEOUT = 7 * ONE_MINUTE;

const publicGateway = "https://ipfs.io/ipfs";

export async function getFromPublicNode(cid: string) {
  logger.debug({ cid }, "Downloading file from public node");
  const resp = await asyncRetry(
    async (_bail, count) => {
      const url = count % 2 === 0 ? `https://cf-ipfs.com/ipfs/${cid}` : `${publicGateway}/${cid}`;
      logger.trace({ count }, `Starting public download ${url}`);
      try {
        return await ky.get(url, {
          timeout: IPFS_TIMEOUT,
          headers: {
            "User-Agent": GENERAL_USER_AGENT,
          },
        });
      } catch (err) {
        // retry isn't properly triggering with the native exception being thrown for some reason.
        // likely due to some of the weird issues around bundled undici versions and node
        throw new Error("Generic");
      }
    },
    {
      retries: 8,
    }
  );
  return resp;
}

export async function getPeerCount() {
  logger.trace("getting peer count");
  const resp = await ky.post(`${ipfsHost}/swarm/peers`).json<{ Peers: Array<unknown> }>();
  logger.debug({ peers: resp.Peers.length }, "peer count");
  return resp.Peers.length;
}
export async function getUsed() {
  logger.trace("getting disk space used");

  const result = await ky.post(`${ipfsHost}/repo/stat?size-only=true`).json<{
    RepoSize: number;
    StorageMax: number;
    NumObjects: number;
    RepoPath: string;
    Version: string;
  }>();

  logger.debug(
    { MB: result.RepoSize / 1024 / 1024, GB: result.RepoSize / 1024 / 1024 / 1024 },
    "disk space used"
  );
  return result;
}

export async function getId() {
  const resp = await ky.post(`${ipfsHost}/id`).json<{ ID: string }>();
  return resp.ID;
}

export async function getVersion() {
  const resp = await ky
    .post(`${ipfsHost}/diag/sys`)
    .json<{ ipfs_version: string; net: { online: boolean } }>();
  return {
    version: resp.ipfs_version,
    online: resp.net.online,
  };
}

export async function pin(cid: string) {
  await asyncRetry(
    async (_bail, count) => {
      logger.trace({ count }, "Getting pin results");
      const resp = await ky.post(`${ipfsHost}/pin/add?arg=${cid}`).json<{ Pins: Array<string> }>();
      if (resp.Pins.length !== 1) {
        logger.debug(resp, `unexpected pin results`);
        throw new Error("Unexpected Pin Results");
      }
    },
    { retries: 5 }
  );

  logger.debug({ cid }, "Pin complete");
}

export async function check(cid: string, name?: string) {
  logger.debug({ cid, name }, "Checking size in IPFS (cat)");
  const resp = await asyncRetry(
    async (_bail, count) => {
      logger.trace({ count }, "local node cat request");
      return await ky.post(`${ipfsHost}/cat?arg=${cid}`, { timeout: IPFS_TIMEOUT });
    },
    { retries: 5 }
  );
  const arrBuff = await resp.arrayBuffer();
  if (name) {
    logger.debug({ cid, name }, "Name provided, saving to filesystem for debugging");
    await writeFile(`/Users/ryanhirsch/projects/ptk-ipfs/dl/${name}`, Buffer.from(arrBuff));
  }
  logger.debug(`cat got size ${arrBuff.byteLength} for ${cid}`);
  return { length: `${arrBuff.byteLength}` };
}

export async function verifyPin(cid: string, name?: string) {
  logger.debug({ cid, name }, "Checking pinned size in IPFS (ls)");
  const resp = await asyncRetry(
    async (_bail, count) => {
      logger.trace({ count }, "local node ls request");
      return await ky.post(`${ipfsHost}/ls?arg=${cid}`).json<{
        Objects: Array<{
          Hash: string;
          Links: Array<{ Hash: string; Name: string; Size: number; Target: string; Type: number }>;
        }>;
      }>();
    },
    { retries: 5 }
  );
  logger.trace(resp, "IPFS LS result");

  if (resp.Objects.length === 1 && resp.Objects[0].Links.length === 1) {
    const [requestedObject] = resp.Objects;
    const [nestedFile] = requestedObject.Links;
    return { pinned: `${nestedFile.Hash}/${requestedObject.Hash}`, length: nestedFile.Size };
  }

  if (resp.Objects.length === 1 && name) {
    const [requestedObject] = resp.Objects;
    const nestedFile = requestedObject.Links.find((x) => x.Name === name);
    if (nestedFile) {
      return { pinned: `${nestedFile.Hash}/${requestedObject.Hash}`, length: nestedFile.Size };
    }
    throw new Error("Unable to find file by name");
  }

  logger.error;
  throw new Error(`Unexpected path, found ${resp.Objects.length} objects`);
}

export async function unpin(cid: string) {
  logger.debug({ cid }, "Removing Pin");
  const resp = await fetch(`${ipfsHost}/pin/rm?arg=${cid}`, {
    method: "POST",
  });
  const r = await resp.json();
  logger.trace(r, "Pin removed");

  return cid;
}

export async function download(url: string, name: string) {
  logger.debug({ url, name }, "Downloading file");
  const resp = await asyncRetry(
    async (_bail, count) => {
      logger.trace({ count }, `Starting download ${url}`);
      return await ky.get(url, {
        timeout: IPFS_TIMEOUT,
        headers: {
          "User-Agent": GENERAL_USER_AGENT,
        },
      });
    },
    {
      retries: 5,
    }
  );
  const asArrayBuffer = await resp.clone().arrayBuffer();
  logger.debug({ url, name, size: asArrayBuffer.byteLength }, "Size before uploading/pinning");
  const content = await resp.blob();
  const type = resp.headers.get("Content-Type") ?? undefined;

  logger.debug(`Downloaded ${name} (${type})`);

  const form = new FormData();
  form.set("file", new File([content], name, { type }));
  const add = await ky
    .post(`${ipfsHost}/add?wrap-with-directory=true&progress=false&pin=true`, {
      body: form,
    })
    .text();

  // Results is basically NDJSON, so lets split and parse
  const [file, directory] = add
    .split("\n")
    .filter(Boolean)
    .map<{ Name: string; Hash: string; Size: string }>((x) => JSON.parse(x.trim()));

  logger.info(`Added ${url} to IPFS ${file.Hash}`);
  logger.debug({ downloaded: `${file.Hash}/${directory.Hash}`, cid: file.Hash });

  return {
    downloaded: `${file.Hash}/${directory.Hash}`,
    cid: file.Hash,
    originalSize: asArrayBuffer.byteLength.toString(),
  };
}
