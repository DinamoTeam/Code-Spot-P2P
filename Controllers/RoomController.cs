using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Internal;
using CodeSpotP2P.Data;
using CodeSpotP2P.Model;
using Code_Spot_P2P.Data.DTO;

namespace CodeSpotP2P.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class RoomController: ControllerBase
    {
        private readonly DataContext _database;
        private static long siteId = 1;
        public RoomController(DataContext database)
        {
            _database = database;
        }

        // GET: api/Room/GetPeerIdsInRoom?roomName=abc
        [HttpGet]
        public async Task<IActionResult> GetPeerIdsInRoom(string roomName)
        {
            if (await RoomExist(roomName))
            {
                var peerIds = await _database.peers.Where(p => p.RoomName == roomName)
                                         .Select(p => p.PeerId)
                                         .ToListAsync();
                return Ok(peerIds);
            }
            return Ok(null);
        }
        // GET: api/Room/JoinNewRoom?peerId=abc
        [HttpGet]
        public async Task<IActionResult> JoinNewRoom(string peerId)
		{
            string roomName = GenerateRoomName();
            _database.rooms.Add(new Room(roomName));
            _database.peers.Add(new Peer(peerId, roomName, 1));
            await _database.SaveChangesAsync();
            
            var info = new EnterRoomInfo(RoomController.siteId++, roomName, new List<string>(),
                new List<int>());
            return Ok(info);
		}

        // Get: api/Room/JoinExistingRoom?peerId=abc&roomName=def
        [HttpGet]
        public async Task<IActionResult> JoinExistingRoom(string peerId, string roomName)
		{
            if (await RoomExist(roomName))
            {
                var peerIds = await _database.peers.Where(p => p.RoomName == roomName)
                                         .Select(p => p.PeerId)
                                         .ToListAsync();

                var hasReceivedAllMessagesList = await _database.peers
                                         .Where(p => p.RoomName == roomName)
                                         .Select(p => p.HasReceivedAllMessages)
                                         .ToListAsync();

                _database.peers.Add(new Peer(peerId, roomName, 0));
                await _database.SaveChangesAsync();
                var info = new EnterRoomInfo(RoomController.siteId++, roomName, peerIds, hasReceivedAllMessagesList);
                return Ok(info);
            }
            return Ok(new EnterRoomInfo(-1, null, null, null));
        }

        // Get: api/Room/MarkPeerReceivedAllMessages?peerId=abc
        [HttpGet]
        public async Task<IActionResult> MarkPeerReceivedAllMessages(string peerId) {
            var peer = await _database.peers.FirstOrDefaultAsync(p => p.PeerId == peerId);
            if (peer != null)
            {
                peer.HasReceivedAllMessages = 1;
                await _database.SaveChangesAsync();
            }
            return Ok(200);
        } 

        private async Task<bool> RoomExist(string roomName)
        {
            if (await  _database.rooms.AnyAsync(r => r.RoomName == roomName))
            {
                return true;
            }
            return false;
        }

        private string GenerateRoomName()
        {
            while (true)
            {
                string randomName = Guid.NewGuid().ToString();

                if (_database.rooms.FirstOrDefault(r => r.RoomName == randomName) == null)
                {
                    return randomName;
                }
            }
        }

        // Get: api/Room/DeletePeer?peerId=abc
        [HttpGet]
        public async Task<IActionResult> DeletePeer(string peerId)
		{
            // peer.PeerID is unique by itself. It is a UUID
            Peer peer = _database.peers.FirstOrDefault(p => p.PeerId == peerId);
            if (peer != null)
            {
                _database.peers.Remove(peer);
                await _database.SaveChangesAsync();

                // Delete room if nobody's in it
                if (!_database.peers.Any(p => p.RoomName == peer.RoomName))
                {
                    Room room = _database.rooms.FirstOrDefault(r => r.RoomName == peer.RoomName);
                    _database.rooms.Remove(room);
                    await _database.SaveChangesAsync();
                }
            }

            return Ok(200);
        }
    }
}