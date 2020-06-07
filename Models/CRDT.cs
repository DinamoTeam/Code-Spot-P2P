using System.ComponentModel.DataAnnotations;

namespace Code_Spot.Models
{
    public class CRDT
    {
        public CRDT() { }
        public CRDT(string crdt, string roomName)
        {
            this.CRDTObject = crdt;
            this.RoomName = roomName;
        }
        
        public int Id { get; set; }
        public string CRDTObject { get; set; } // Looks like <<1,3><4,5><3,4><4,3>8>a
        public string RoomName { get; set; }
        public Room Room { get; set; }

    }
}