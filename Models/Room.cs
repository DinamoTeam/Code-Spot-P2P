using System.ComponentModel.DataAnnotations;

namespace Code_Spot.Models
{
    public class Room
    {
        [Key]
        public string Name { get; set; }
        public CRDT Crdt { get; set; }
    }
}