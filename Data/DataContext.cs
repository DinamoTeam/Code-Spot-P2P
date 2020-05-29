using Code_Spot.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace CodeSpot.Data
{
    public class DataContext: DbContext
    {
        public DataContext(DbContextOptions<DataContext> options): base(options) { }

        public DbSet<Room> Rooms { get; set; }
        public DbSet<CRDT> CRDTs { get; set; }
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<CRDT>().
                HasKey(c => new { c.CRDTObject, c.RoomName});
        }
    }
}
