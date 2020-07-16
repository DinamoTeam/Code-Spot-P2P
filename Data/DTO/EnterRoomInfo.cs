using System.Collections.Generic;

namespace Code_Spot_P2P.Data.DTO
{
    public class EnterRoomInfo
    {
        public EnterRoomInfo(long siteId, string roomName, int cursorColor, List<string> peerIds,
             List<int> hasReceivedAllMessages, List<int> cursorColors)
        {
            this.RoomName = roomName;
            this.PeerIds = peerIds;
            this.CursorColor = cursorColor;
            this.SiteId = siteId;
            this.HasReceivedAllMessages = hasReceivedAllMessages;
            this.CursorColors = cursorColors;
        }
        public long SiteId { get; set; }
        public string RoomName { get; set; }
        public List<string> PeerIds { get; set; }
        public List<int> HasReceivedAllMessages { get; set; }
        public List<int> CursorColors { get; set; }
        public int CursorColor { get; set; }
    }
}