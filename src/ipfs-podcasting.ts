import ky from "ky";

import { getId, getPeerCount, getUsed, getVersion } from "./ipfs-commands";
import { logger } from "./logger";
import { IPFS_PODCASTING_CLIENT_AGENT } from "./helpers";

const ipfsRequest = "https://IPFSPodcasting.net/Request";
const ipfsResponse = "https://IPFSPodcasting.net/Response";
const email = process.env.USER_EMAIL;
if (!email) {
  throw new Error("USER_EMAIL not set on the environment");
} else {
  logger.info(`User identified as ${email}`);
}
const defaultPayload = { email, version: "0.6n" };

function toFormString(val: boolean | string | number) {
  if (typeof val === "string") {
    return val;
  }
  if (typeof val === "number") {
    return `${val}`;
  }

  return val ? "true" : "false";
}

async function getIdAndMetadata() {
  const id = await getId();
  const peers = await getPeerCount();
  const { version, online } = await getVersion();

  return { ...defaultPayload, peers, ipfs_id: id, ipfs_ver: version, online };
}

export async function getWork(): Promise<{
  show: string;
  episode: string;
  download: string;
  pin: string;
  filename: string;
  delete: string;
  message: string;
}> {
  const body = await getIdAndMetadata();
  return ky
    .post(ipfsRequest, {
      headers: {
        "User-Agent": IPFS_PODCASTING_CLIENT_AGENT,
        Accept: "application/json",
      },
      body: Object.entries(body).reduce((f, [k, v]) => {
        f.set(k, toFormString(v));
        return f;
      }, new FormData()),
    })
    .json<{
      show: string;
      episode: string;
      download: string;
      pin: string;
      filename: string;
      delete: string;
      message: string;
    }>();
}

type PinResponse = {
  length: number;
  pinned: string;
};
type DownloadResponse = {
  downloaded: string;
  length: string;
};
type DeleteResponse = {
  deleted: string;
};
type ErrorResponse = {
  error: string;
  errorMessage?: string;
};
type WorkResponse = DownloadResponse | ErrorResponse | DeleteResponse | PinResponse;
export async function sendResponse(response: WorkResponse) {
  logger.debug(response, "Sending results to server");
  const { RepoSize } = await getUsed();
  const body = {
    ...(await getIdAndMetadata()),
    ...response,
    used: RepoSize,
    avail: 50 * 1024 * 1024 * 1024,
  };
  const resp = await ky.post(ipfsResponse, {
    headers: {
      "User-Agent": IPFS_PODCASTING_CLIENT_AGENT,
      Accept: "application/json",
    },
    body: Object.entries(body).reduce((f, [k, v]) => {
      f.set(k, toFormString(v));
      return f;
    }, new FormData()),
  });
  return resp.text();
}
