namespace CodeSpotP2P.Model
{
    public class Peer
    {
        public int Id { get; set; }
        public string PeerId { get; set; }
        public string RoomName { get; set; }
        public Room Room { get; set; }
        public Peer(string peerId, string roomName)
        {
            PeerId = peerId;
            RoomName = roomName;
        }

        public Peer() {}
    }
}