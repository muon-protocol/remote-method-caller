import process from 'node:process'
import {createLibp2p} from 'libp2p'
import {tcp} from '@libp2p/tcp'
import {noise} from '@chainsafe/libp2p-noise'
import {mplex} from '@libp2p/mplex'
import {multiaddr} from 'multiaddr'
import {createFromJSON} from "@libp2p/peer-id-factory";
import {pipe} from "it-pipe";
import {toString as uint8ArrayToString} from "uint8arrays/to-string";
import {fromString as uint8ArrayFromString} from "uint8arrays/from-string";
import axios from "axios"
import * as dotenv from 'dotenv'
dotenv.config();

let nodeResponseLoaded = false;
let nodesResponse = [];

async function loadNodes() {
    axios.get("https://monitor1.muon.net/nodes")
        .then(({data}) => {
            if (data.success) {
                nodeResponseLoaded = true;
                nodesResponse = data.result;
            }
        })
        .catch((e) => {
            console.log("error checkActiveNodes: " + e.message);
            return false;
        });
}

loadNodes();
setInterval(loadNodes, 10 * 60000);

function getNodeByIp(ip) {
    for (let i = 0; i < nodesResponse.length; i++)
        if (nodesResponse[i].ip == ip)
            return nodesResponse[i];
    return null
}

function getNodeById(id) {
    for (let i = 0; i < nodesResponse.length; i++)
        if (nodesResponse[i].id == id)
            return nodesResponse[i];
    return null
}


const chatProtocol = '/muon/network/remote-call/1.0.0';


let dialerPeerId = {
    id: process.env.NODE_ID,
    privKey: process.env.NODE_PRV_KEY,
    pubKey: process.env.NODE_PUB_KEY
};


const peerId = await
createFromJSON(dialerPeerId);

const libp2p = await
createLibp2p({
    peerId,
    addresses: {
        listen: ['/ip4/0.0.0.0/tcp/0']
    },
    transports: [tcp()],
    connectionEncryption: [noise()],
    streamMuxers: [mplex()],
});


await
libp2p.start();
console.log('libp2p has started');


console.log('listening on addresses:');
libp2p.getMultiaddrs().forEach((addr) => {
    console.log(addr.toString())
});

const stop = async () => {
    await libp2p.stop();
    console.log('libp2p has stopped');
    process.exit(0)
};

export async function call(req) {
    let request = req.body;
    let module = req.params.module;
    let method = req.params.method;

    if (module == "BaseAppPlugin")
        module = "DynamicExtended(tss@BaseAppPlugin)";

    if (request.method) {
        method = request.method;
    } else {
        method = module + "." + method;
    }

    let deployerNodeIps = ["104.131.177.195", "167.71.60.172", "3.130.24.220", "18.221.53.56", "194.195.211.27", "194.195.244.101", "209.250.252.247", "95.179.139.243"];


    let ma;

    if (request.ma)
        ma = multiaddr(request.ma);
    else if (deployerNodeIps.includes(request.ip)) {
        ma = multiaddr(`/ip4/${request.ip}/tcp/5000`);
    } else if (request.ip || request.id) {
        let nodeInfo;
        if (request.ip)
            nodeInfo = getNodeByIp(request.ip);
        if (request.id)
            nodeInfo = getNodeById(request.id);
        if (!nodeInfo)
            return "node info not found";
        ma = multiaddr(`/ip4/${nodeInfo.ip}/tcp/${nodeInfo.networkingPort}`);
    } else {
        //default
        ma = multiaddr(`/ip4/104.131.177.195/tcp/5000`);
    }


    let stream;
    try {
        stream = await
            libp2p.dialProtocol(ma, chatProtocol);
    } catch (e) {
        return "Error dialProtocol " + e.message;
    }

    let data = {
        callId: "1gnuln3hnjdqtm3" + Math.floor(Math.random() * 1e12).toString(),
        method: "NetworkIpcHandler.exec-ipc-remote-call",
        params: {
            method: method,
            params: request.params
        }
    };

    if (method.includes("NetworkIpcHandler"))
        data = {
            callId: "1gnuln3hnjdqtm3" + Math.floor(Math.random() * 1e12).toString(),
            method: method,
            params: request.params
        };


    let dataStr = JSON.stringify(data);
    return pipe([uint8ArrayFromString(dataStr)], stream, async function (source) {
        for await (const data of source) {
            let jsonResp = JSON.parse(uint8ArrayToString(data.subarray()));
            return jsonResp;
        }
    });
}

process.on('SIGTERM', stop);
process.on('SIGINT', stop);

