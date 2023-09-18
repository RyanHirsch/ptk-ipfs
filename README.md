# Podcast Toolkit IPFS Client

Exploration around using the RPC API for controlling an IPFS server rather than [the standard client](https://github.com/Cameron-IPFSPodcasting/podcastnode-Python) (Python + CLI) originally developed by
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

DAI is terrible, and yields different results so the sizes you obtain may not be what ipfspodcasting thinks is proper.

Size mismatches can occur by ANY of the following:

- different requesting User-Agents
- different requesting IPs
- different requesting locations
