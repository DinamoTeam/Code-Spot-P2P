const express = require("express");
const roomsRoutes = express.Router();
const dbo = require("../db/conn");
const ObjectId = require("mongodb").ObjectId;
const { v4: uuidv4 } = require('uuid');

let siteId = 1;

// GET: api/Room/GetPeerIdsInRoom?roomName=abc
roomsRoutes.route("/api/Room/GetPeerIdsInRoom").get(async function (req, res) {
    await dbConnection();
    const roomName = req.query.roomName;
    const isRoomExist = await roomExist(roomName);

    if (!isRoomExist) {
        return res.json({});
    }

    let db_connect = dbo.getDb();
    const query = { roomName };
    const peers = await db_connect
        .collection("peers").find(query).toArray();

    const peerIds = peers.map(peer => peer.peerId);

    res.json({ peerIds });
});

// GET: api/Room/JoinNewRoom?peerId=abc
roomsRoutes.route("/api/Room/JoinNewRoom").get(async function (req, res) {
    await dbConnection();
    const peerId = req.query.peerId;
    const roomName = await generateRoomName();
    const cursorColor = getRandom(1, 25) + 1;

    let db_connect = dbo.getDb();

    await db_connect.collection("rooms").insertOne({ roomName });
    await db_connect.collection("peers").insertOne({
        peerId,
        roomName,
        hasReceivedAllMessages: 1,
        cursorColor,
    });
    const info = {
        siteId: siteId++,
        roomName,
        cursorColor,
        peerIds: [],
        hasReceivedAllMessages: [],
        cursorColors: [],
    };

    return res.json(info);
});

// Get: api/Room/JoinExistingRoom?peerId=abc&roomName=def
roomsRoutes.route("/api/Room/JoinExistingRoom").get(async function (req, res) {
    await dbConnection();
    const peerId = req.query.peerId;
    const roomName = req.query.roomName;
    const isRoomExist = await roomExist(roomName);

    if (!isRoomExist) {
        const info = {
            siteId: -1,
            roomName: null,
            cursorColor: -1,
            peerIds: null,
            hasReceivedAllMessages: null,
            cursorColors: null,
        };

        return res.json(info);
    }

    let db_connect = dbo.getDb();
    const query = { roomName };
    const peers = await db_connect
        .collection("peers").find(query).toArray();
    const peerIds = peers.map(peer => peer.peerId);
    const hasReceivedAllMessagesList = peers.map(peer => peer.hasReceivedAllMessages);
    const cursorColorList = peers.map(peer => peer.cursorColor);

    const randomColor = getAvailableCursorColor(roomName);
    await db_connect.collection("rooms").insertOne({
        peerId,
        roomName,
        hasReceivedAllMessages: 0,
        randomColor,
    });
    const info = {
        siteId: siteId++,
        roomName,
        cursorColor: randomColor,
        peerIds,
        hasReceivedAllMessages: hasReceivedAllMessagesList,
        cursorColors: cursorColorList,
    };

    return res.json(info);
});

// Post: api/Room/MarkPeerReceivedAllMessages
roomsRoutes.route("/api/Room/MarkPeerReceivedAllMessages").post(async function (req, res) {
    await dbConnection();
    const peerId = req.body.Val;
    let db_connect = dbo.getDb();
    const query = { peerId };
    await db_connect
        .collection("peers")
        .updateOne(query, {
            $set: {
                hasReceivedAllMessages: 1
            }
        });
    res.json({});
});

// Delete: api/Room/DeletePeer/abc
roomsRoutes.route("/api/Room/DeletePeer/:peerId").post(async function (req, res) {
    await dbConnection();
    const peerId = req.params.peerId;
    let db_connect = dbo.getDb();
    let query = { peerId };
    const peer = await db_connect
        .collection("peers").findOne(query);

    if (peer === null) {
        return res.json({});
    }

    query = { _id: peer._id };
    await db_connect
        .collection("peers").deleteOne(query);
    query = { peerId };
    const peers = await db_connect
        .collection("peers").find(query).toArray();
    const nobodyInRoom = peers.length === 0;
    if (nobodyInRoom) {
        query = { roomName: peer.roomName };
        await db_connect
            .collection("rooms").deleteOne(query);
    }
});

async function roomExist(roomName) {
    let db_connect = dbo.getDb();
    const query = { roomName };

    const room = await db_connect
        .collection("rooms").findOne(query);

    return room !== null;
}

async function generateRoomName() {
    const randomName = uuidv4();

    let db_connect = dbo.getDb();
    const query = { roomName: randomName };
    const room = await db_connect
        .collection("rooms").findOne(query);

    if (room === null) {
        return randomName;
    }
}

async function getAvailableCursorColor(roomName) {
    let db_connect = dbo.getDb();
    const query = { roomName };
    const peers = await db_connect
        .collection("peers").find(query).toArray();
    const cursorColorList = peers.map(peer => peer.cursorColor);
    let randomColor = getRandom(1, 25) + 1;
    if (cursorColorList.Count >= 25) {
        return randomColor;
    }

    while (cursorColorList.includes(randomColor)) {
        randomColor = getRandom(1, 25) + 1;
    }

    return randomColor;
}

function getRandom(min, max) {
    return Math.random() * (max - min) + min;
}

async function dbConnection() {
    await dbo.connectToServer(async function (err) {
        if (err) {
            console.log(err);
        }
    });
}
module.exports = roomsRoutes;
