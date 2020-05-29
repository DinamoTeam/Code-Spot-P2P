using System.ComponentModel.DataAnnotations;

namespace Code_Spot.Models
{
    public class Room
    {
        public Room(string name)
        {
            this.Name = name;
        }
        [Key]
        public string Name { get; set; }
        public CRDT Crdt { get; set; }
    }
}