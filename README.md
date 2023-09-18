# Podcast Toolkit IPFS Client

Exploration around using the [RPC API](https://docs.ipfs.tech/reference/kubo/rpc/) for controlling an [IPFS Podcasting](https://ipfspodcasting.net) node rather than [the standard client](https://github.com/Cameron-IPFSPodcasting/podcastnode-Python) (Python + CLI) originally developed by
[Cameron](https://github.com/Cameron-IPFSPodcasting)

This code expects to be running on Node v20.7 or higher

This code is also dirty and in flux, its not ready for novice people to use.

This code expects a `USER_EMAIL` to be set as an environment variable.

## Starting an IPFS server

All testing has been done via a vanilla ipfs container

```
docker run -it --rm --name ipfs_host \
  -v <SOME_LOCAL_PATH>/staging:/export \
  -v <SOME_LOCAL_PATH>/data:/data/ipfs \
  -p 4001:4001 -p 4001:4001/udp -p 127.0.0.1:8080:8080 -p 127.0.0.1:5001:5001 \
  ipfs/kubo:latest
```

## Known Issues

DAI is terrible, and yields different results so the sizes you obtain may not be what existing nodes have reported and what ipfspodcasting thinks is proper. When this happens you'll see a "Fail" near your node's current status in the [management console](https://ipfspodcasting.net/Manage/Node). This also usually results in your node getting repeated work to download and verify the same episode because you are an outlier with the existing and presumed correct data.

Size mismatches can occur by ANY of the following:

- different requesting User-Agents
- different requesting IPs
- different requesting locations
- the actual file has changed
- Hosts deciding to deliver different data to you for unknown other reasons

Yeah, you're pretty much out of luck when this happens and it limits the ability of this whole thing to work as intended. joy...

If your node an others get "stuck" in this state, ipfspodcasting will attempt to detect the size differences (likely caused by DAI) and make adjustments so that you and others can join in the hosting even though there is a size discrepancy. (see: https://podcastindex.social/@cameron/111088092247741722)
