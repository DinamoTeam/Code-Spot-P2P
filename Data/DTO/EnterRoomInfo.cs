using System.Collections.Generic;

namespace Code_Spot_P2P.Data.DTO
{
    public class EnterRoomInfo
    {
        public EnterRoomInfo(long siteId, string roomName, List<string> peerIds)
        {
            this.RoomName = roomName;
            this.PeerIds = peerIds;
            this.SiteId = siteId;
        }
        public long SiteId { get; set; }
        public string RoomName { get; set; }
        public List<string> PeerIds { get; set; }
    }
}