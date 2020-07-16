using Microsoft.EntityFrameworkCore.Migrations;

namespace CodeSpot.Migrations
{
    public partial class FirstMigration : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "rooms",
                columns: table => new
                {
                    RoomName = table.Column<string>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rooms", x => x.RoomName);
                });

            migrationBuilder.CreateTable(
                name: "peers",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PeerId = table.Column<string>(nullable: true),
                    RoomName = table.Column<string>(nullable: true),
                    HasReceivedAllMessages = table.Column<int>(nullable: false),
                    CursorColor = table.Column<int>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_peers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_peers_rooms_RoomName",
                        column: x => x.RoomName,
                        principalTable: "rooms",
                        principalColumn: "RoomName",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_peers_RoomName",
                table: "peers",
                column: "RoomName");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "peers");

            migrationBuilder.DropTable(
                name: "rooms");
        }
    }
}
