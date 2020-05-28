using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace CodeSpot.Hubs
{
	public class MessageHub : Hub
	{
		public Task SendMessageToAll(string message)
		{
			return Clients.All.SendAsync("NameofJSReceiverMethod", message);
		}
	}
}
