import { HTTPError } from "ky";
import { WorkResponse, getWork, sendResponse } from "./ipfs-podcasting";
import { ONE_MINUTE } from "./helpers";
import { check, download, getFromPublicNode, pin, unpin, verifyPin } from "./ipfs-commands";
import { logger } from "./logger";

let last = "";

enum ErrorCodes {
  DownloadError = "99",
  PinError = "98",
  GenericError = "1",
}
// New Episodes only
// https://ipfspodcasting.net/Favorite/Future/{FEED_ID}/{NODE_ID}

// All Episodes
// https://ipfspodcasting.net/Favorite/All/{FEED_ID}/{NODE_ID}

// https://docs.ipfs.tech/reference/kubo/rpc/

function logAndProxy<T>(message: string) {
  return (result: T) => {
    logger.trace(result, message);
    return result;
  };
}

async function getDownloadSize(cid: string) {
  try {
    const resp = await getFromPublicNode(cid);
    logger.trace({ cid }, "Public Download complete");
    logger.trace("Getting an arrayBuffer of the public download");
    // undici sometimes chokes here with the following error - `terminated: other side closed`
    const asArrayBuffer = await resp.arrayBuffer();
    logger.trace("Got the arrayBuffer");
    return asArrayBuffer.byteLength.toString();
  } catch (err) {
    logger.error(err, "Failed public gateway fetch");
    if (err instanceof HTTPError) {
      logger.error({
        msg: err.message,
        status: err.response.status,
        statusText: err.response.statusText,
      });
    }
    return "0";
  }
}

async function getSizes(dirFile: string, name: string) {
  try {
    logger.debug({ dirFile, name }, "Getting all sizes to compare");
    const [fileCid, dirCid] = dirFile.split("/");
    logger.debug({ fileCid, dirCid }, "Destructured hashes");
    const [lsResult, catResult, publicResult] = await Promise.all([
      verifyPin(dirCid, name).then(logAndProxy("Verify Pin")),
      check(fileCid).then(logAndProxy("Check Result")),
      getDownloadSize(fileCid).then(logAndProxy("Public Download")),
    ]);

    if (publicResult === "0") {
      logger.warn("Public results failed, returning cat and ls results only");
      return {
        lsResult: lsResult.length.toString(),
        catResult: catResult.length,
      };
    }
    return {
      publicResult,
      lsResult: lsResult.length.toString(),
      catResult: catResult.length,
    };
  } catch (err) {
    logger.error(err, "Error comparing ls to cat");
  }
}

async function getAndDoWork() {
  const workCompleted: Array<WorkResponse> = [];
  console.log("");
  console.log("");
  console.log("");
  logger.info("Getting work");
  const work = await getWork();
  logger.debug(work, "Received work");
  if (/no work/i.test(work.message)) {
    setTimeout(getAndDoWork, 5 * ONE_MINUTE);
    return;
  }

  if (work.download && work.filename) {
    try {
      const { downloaded, cid, originalSize } = await download(work.download, work.filename);
      const compareResults = await getSizes(downloaded, work.filename);
      logger.debug(compareResults, "Full comparison");
      if (compareResults && Object.values(compareResults).every((r) => originalSize === r)) {
        logger.debug("All sizes match");
        workCompleted.push({ downloaded, length: originalSize });
      } else {
        const { length } =
          last === work.download ? await check(downloaded, work.filename) : await check(cid);
        logger.debug({ downloaded, cid, length }, "Sending download results");

        workCompleted.push({ downloaded, length: length });
      }
    } catch (err) {
      logger.error(err, "Failed to download");
      if (err instanceof HTTPError) {
        logger.debug("resp", err.response);
        logger.debug("status", err.response.status);
        logger.debug("name", err.name);
        logger.debug("message", err.message);
        workCompleted.push({ error: ErrorCodes.DownloadError, errorMessage: err.message });
      } else {
        workCompleted.push({ error: ErrorCodes.GenericError });
      }
    }
    last = work.download;
    logger.info("Completed download work");
  }

  if (work.pin) {
    try {
      await pin(work.pin);
      logger.debug("Successfully pinned");
    } catch (err) {
      logger.error(err, "Failed to pin");
      workCompleted.push({ error: ErrorCodes.PinError });
    }
    try {
      const { pinned, length } = await verifyPin(work.pin, work.filename);
      workCompleted.push({ pinned: pinned, length: length });
    } catch (err) {
      logger.error(err, "Failed to determine pin size");
      workCompleted.push({ error: ErrorCodes.GenericError });
    }
    logger.info("Completed pinning work");
  }

  if (work.delete) {
    try {
      const removedCid = await unpin(work.delete);
      logger.debug({ removedCid }, "Sending delete results");
      workCompleted.push({ deleted: removedCid });
    } catch (err) {
      logger.error(err, "Failed to delete pin");
      workCompleted.push({ error: ErrorCodes.GenericError });
    }
  }

  if (workCompleted.length > 0) {
    await sendResponse(workCompleted);
    logger.info(workCompleted, "Completed all work");
    setTimeout(getAndDoWork, 0.5 * ONE_MINUTE);
    return;
  }

  // getting here means we got an unexpected work payload and did nothing
  console.log(work);
}

(async function run() {
  await getAndDoWork();
})();
