using Code_Spot.Data.DTO;
using Code_Spot.Models;
using CodeSpot.Data;
using CodeSpot.Data.DTO;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

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
			string clientId = (curId++).ToString();
			await Clients.Client(Context.ConnectionId).SendAsync("MessageFromServer", new MessageDTO() { Type = MessageType.SiteId, Content = clientId });
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
			await SendMessageToCallerClient(MessageType.RoomName, roomName);
		}

		public async Task JoinExistingRoom(string roomName)
		{
			// TODO: Check if roomName exists. If not, somehow tell that to user
			await Groups.AddToGroupAsync(Context.ConnectionId, roomName);
			await GetAllPreviousMessages(roomName);
		}

		public async Task GetAllPreviousMessages(string roomName)
		{
			List<string> messages = await _database.CRDTs.Where(c => c.RoomName == roomName).Select(e => e.CRDTObject).ToListAsync();

			await SendMessagesToCallerClient(MessageType.AllMessages, messages);
		}

		public async Task ExecuteInsert(string content, string roomName)
		{
			string crdtObject = content;

			if (! await _database.CRDTs.AnyAsync(c => c.CRDTObject == crdtObject && c.RoomName == roomName))
			{
				await _database.CRDTs.AddAsync(new CRDT(crdtObject, roomName));
				await _database.SaveChangesAsync();
				await SendMessageToOtherClientsInGroup(roomName, MessageType.RemoteInsert, content);
			}
		}

		public async Task ExecuteRemove(string content, string roomName)
		{
			string crdtObject = content;
			CRDT crdtFromDb = await _database.CRDTs.FirstOrDefaultAsync(
				c => c.CRDTObject == crdtObject && c.RoomName == roomName);

			if (crdtFromDb != null)
			{
				_database.CRDTs.Remove(crdtFromDb);
				await _database.SaveChangesAsync();
				await SendMessageToOtherClientsInGroup(roomName, MessageType.RemoteRemove, content);
			}
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

		public async Task SendMessagesToCallerClient(string type, List<string> content)
		{
			await Clients.Caller.SendAsync("MessageFromServer", new MessagesDTO() { Type = type, Messages = content });
		}

		public async Task SendMessageToCallerClient(string type, string content)
		{
			await Clients.Caller.SendAsync("MessageFromServer", new MessageDTO() { Type = type, Content = content });
		}

		public async Task SendMessageToOtherClientsInGroup(string roomName, string type, string content)
		{
			await Clients.OthersInGroup(roomName).SendAsync("MessageFromServer", new MessageDTO() { Type = type, Content = content });
		}
	}

	public sealed class MessageType
	{
		public const string SiteId = "SiteId";
		public const string RoomName = "RoomName";
		public const string RemoteInsert = "RemoteInsert";
		public const string RemoteRemove = "RemoteRemove";
		public const string AllMessages = "AllMessages";
		public const string Test = "Test";
	}
}
