using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Code_Spot.Data.DTO;
using Code_Spot.Models;
using CodeSpot.Data;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace CodeSpot.Hubs
{
    public class MessageHub : Hub
    {
        private static long curId = 1;
        private readonly DataContext _database;

        public MessageHub(DataContext database)
        {
            _database = database;
        }

        public override async Task OnConnectedAsync()
        {
            string clientId = "" + (curId++);
            await Clients.Client(Context.ConnectionId).SendAsync("SiteId", clientId);
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception e)
        {
            await base.OnDisconnectedAsync(e);
        }

		public async Task CreateNewRoom()
		{
			string roomName = GenerateRoomName();
			_database.Rooms.Add(new Room(roomName));
			await _database.SaveChangesAsync();
			await Groups.AddToGroupAsync(Context.ConnectionId, roomName);
			await Clients.Caller.SendAsync("RoomName", roomName);
		}

		public async Task JoinExistingRoom(string roomName)
		{
			// TODO: Check if roomName exists. If not, somehow tell that to user
			await Groups.AddToGroupAsync(Context.ConnectionId, roomName);
			await SendPreviousMessagesToCaller(roomName);
		}

		public async Task SendPreviousMessagesToCaller(string roomName)
		{
			string result = "";
			await _database.CRDTs.Where(c => c.RoomName == roomName)
								 .ForEachAsync(c => {result += c.CRDTObject + '\n';});
			await Clients.Caller.SendAsync("AllMessages", result);
		}

        private string GenerateRoomName()
		{
			while (true)
			{
				string randomName = Guid.NewGuid().ToString();
				if (_database.Rooms.FirstOrDefault(r => r.Name == randomName) == null)
				{
					return randomName;
				}
			}
		}


		public async Task ExecuteInsert(MessageDTO message, string roomName)
		{
			string crdtObject = message.Content;
			CRDT crdtFromDb = await _database.CRDTs.FirstOrDefaultAsync(
				c => c.CRDTObject == crdtObject && c.RoomName == roomName);

			if (crdtFromDb == null)
			{
				_database.CRDTs.Add(new CRDT(crdtObject, roomName));
				await _database.SaveChangesAsync();
				await Clients.OthersInGroup(roomName).SendAsync("RemoteInsert", message);
			}
		}

		public async Task ExecuteRemove(MessageDTO message, string roomName)
		{
			string crdtObject = message.Content;
			CRDT crdtFromDb = await _database.CRDTs.FirstOrDefaultAsync(
				c => c.CRDTObject == crdtObject && c.RoomName == roomName);

			if (crdtFromDb != null)
			{
				_database.CRDTs.Remove(crdtFromDb);
				await _database.SaveChangesAsync();
				await Clients.OthersInGroup(roomName).SendAsync("RemoteRemove", message);
			}
		}
    }
}
