import ky from "ky";

import { getId, getPeerCount, getUsed, getVersion } from "./ipfs-commands";
import { logger } from "./logger";

const ipfsRequest = "https://IPFSPodcasting.net/Request";
const ipfsResponse = "https://IPFSPodcasting.net/Response";
const defaultPayload = { email: "ryan.hirsch@gmail.com", version: "0.6p" };

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
        "User-Agent": "ptk-ipfs/0.1",
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
      "User-Agent": "ptk-ipfs/0.1",
      Accept: "application/json",
    },
    body: Object.entries(body).reduce((f, [k, v]) => {
      f.set(k, toFormString(v));
      return f;
    }, new FormData()),
  });
  return resp.text();
}
