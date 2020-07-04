using Microsoft.EntityFrameworkCore;
using CodeSpotP2P.Model;

namespace CodeSpotP2P.Data
{
    public class DataContext : DbContext
    {
        public DataContext(DbContextOptions<DataContext> options) : base(options) {}
        public DbSet<Room> rooms { get; set; }
        public DbSet<Peer> peers { get; set; }

    }
}