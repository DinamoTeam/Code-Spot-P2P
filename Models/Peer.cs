namespace CodeSpotP2P.Model
{
    public class Peer
    {
        public int Id { get; set; }
        public string PeerId { get; set; }
        public string RoomName { get; set; }
        public int HasReceivedAllMessages { get; set;} // 0 or 1
        public int CursorColor { get; set; } // 1 to 100
        public Room Room { get; set; }
        public Peer(string peerId, string roomName, int hasReceivedAllMessages, int cursorColor)
        {
            PeerId = peerId;
            RoomName = roomName;
            this.HasReceivedAllMessages = hasReceivedAllMessages;
            this.CursorColor = cursorColor;
        }

        public Peer() {}
    }
}