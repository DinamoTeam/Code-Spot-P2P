namespace Code_Spot.Dtos
{
    public class Message
    {
        public Message(string crdt)
        {
            this.CRDTObject = crdt;
        }
        public string CRDTObject { get; set; }
    }
}