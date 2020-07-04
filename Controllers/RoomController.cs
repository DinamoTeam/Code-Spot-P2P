using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Internal;
using CodeSpotP2P.Data;
using CodeSpotP2P.Model;

namespace CodeSpotP2P.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class RoomController: ControllerBase
    {
        private readonly DataContext _database;
        public RoomController(DataContext database)
        {
            _database = database;
        }

        // GET: api/Room/GetPeerIds?roomName=abc
        [HttpGet]
        public async Task<ActionResult<IEnumerable<string>>> GetPeerIds(string roomName)
        {
            return await _database.peers.Where(peer => peer.RoomName == roomName)
                                        .Select(peer => peer.PeerId)
                                        .ToListAsync();
        }

        // GET: api/Room/JoinNewRoom?peerId=abc
        [HttpGet]
        public async Task<ActionResult<string>> JoinNewRoom(string peerId)
		{
            string roomName = GenerateRoomName();
            _database.rooms.Add(new Room(roomName));
            _database.peers.Add(new Peer(peerId, roomName));
            await _database.SaveChangesAsync();

            return roomName;
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
                _database.peers.Add(new Peer(peerId, roomName));
                await _database.SaveChangesAsync();
                return Ok(peerIds);
            }
            return Ok(new List<string> { "ROOM_NOT_EXIST" });
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
            }

            // Delete room if nobody's in it
            if (!_database.peers.Any(p => p.RoomName == peer.RoomName))
            {
                Room room = _database.rooms.FirstOrDefault(r => r.RoomName == peer.RoomName);
                _database.rooms.Remove(room);
                await _database.SaveChangesAsync();
            }


            return Ok(200);
        }
    }
}