import ky, { HTTPError } from "ky";
import asyncRetry from "async-retry";
import { getWork, sendResponse } from "./ipfs-podcasting";
import { ONE_MINUTE } from "./helpers";
import { check, download, getFromPublicNode, pin, unpin, verifyPin } from "./ipfs-commands";
import { logger } from "./logger";

let last = "";

enum ErrorCodes {
  DownloadError = "99",
  PinError = "98",
  GenericError = "1",
}
// container node id = 1775

// New Episodes only
// https://ipfspodcasting.net/Favorite/Future/{FEED ID}/{NODE_ID}

// All Episodes
// https://ipfspodcasting.net/Favorite/All/528/1775

// https://docs.ipfs.tech/reference/kubo/rpc/

async function getDownloadSize(cid: string) {
  try {
    const resp = await getFromPublicNode(cid);
    const asArrayBuffer = await resp.arrayBuffer();
    return asArrayBuffer.byteLength.toString();
  } catch (err) {
    logger.error(err, "Failed public gateway fetch");
    return "0";
  }
}

async function compareLsToCat(dirFile: string, name: string) {
  try {
    logger.debug({ dirFile, name }, "Getting all sizes to compare");
    const [fileCid, dirCid] = dirFile.split("/");
    logger.debug({ fileCid, dirCid }, "Destructured hashes");
    const [lsResult, catResult, publicResult] = await Promise.all([
      verifyPin(dirCid, name),
      check(fileCid),
      getDownloadSize(fileCid),
    ]);

    return {
      publicResult,
      lsResult: lsResult.length.toString(),
      catResult: catResult.length,
    };
  } catch (err) {
    logger.error(err, "Error comparing ls to cat");
  }
}

async function doTheThing() {
  logger.info("Getting work");
  const work = await getWork();
  logger.debug(work, "Received work");
  if (/no work/i.test(work.message)) {
    setTimeout(doTheThing, 5 * ONE_MINUTE);

    return;
  }

  if (work.download && work.filename) {
    try {
      const { downloaded, cid, originalSize } = await download(work.download, work.filename);
      const compareResults = await compareLsToCat(downloaded, work.filename);
      logger.debug(compareResults, "Full comparison");
      if (compareResults && Object.values(compareResults).every((r) => originalSize === r)) {
        logger.debug("All sizes match");
        await sendResponse({ downloaded, length: originalSize });
      } else {
        const { length } =
          last === work.download ? await check(downloaded, work.filename) : await check(cid);
        logger.debug({ downloaded, cid, length }, "Sending download results");

        await sendResponse({ downloaded, length });
      }
    } catch (err) {
      logger.error(err, "Failed to download");
      if (err instanceof HTTPError) {
        logger.debug("resp", err.response);
        logger.debug("status", err.response.status);
        logger.debug("name", err.name);
        logger.debug("message", err.message);
        await sendResponse({ error: ErrorCodes.DownloadError, errorMessage: err.message });
      } else {
        await sendResponse({ error: ErrorCodes.GenericError });
      }
    }
    last = work.download;
    logger.info("Completed download work");
    setTimeout(doTheThing, 0.5 * ONE_MINUTE);

    return;
  }

  if (work.pin) {
    try {
      await pin(work.pin);
      logger.debug("Successfully pinned");
    } catch (err) {
      logger.error(err, "Failed to pin");
      await sendResponse({ error: ErrorCodes.PinError });
      setTimeout(doTheThing, 0.5 * ONE_MINUTE);
      return;
    }
    try {
      const { pinned, length } = await verifyPin(work.pin, work.filename);
      await sendResponse({ pinned, length });
    } catch (err) {
      logger.error(err, "Failed to determine pin size");
      await sendResponse({ error: ErrorCodes.GenericError });
      setTimeout(doTheThing, 0.5 * ONE_MINUTE);
      return;
    }
    logger.info("Completed pinning work");
    setTimeout(doTheThing, 0.5 * ONE_MINUTE);

    return;
  }

  if (work.delete) {
    try {
      const removedCid = await unpin(work.delete);
      logger.debug({ removedCid }, "Sending delete results");

      await sendResponse({ deleted: removedCid });
    } catch (err) {
      logger.error(err, "Failed to delete pin");
    }
    logger.info("Completed delete work");
    setTimeout(doTheThing, 0.5 * ONE_MINUTE);

    return;
  }

  console.log(work);
}

(async function run() {
  await doTheThing();
})();
