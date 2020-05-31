using Microsoft.EntityFrameworkCore.Migrations;

namespace CodeSpot.Migrations
{
    public partial class RoomAndCRDTMigrations : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Rooms",
                columns: table => new
                {
                    Name = table.Column<string>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rooms", x => x.Name);
                });

            migrationBuilder.CreateTable(
                name: "CRDTs",
                columns: table => new
                {
                    CRDTObject = table.Column<string>(nullable: false),
                    RoomName = table.Column<string>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CRDTs", x => new { x.CRDTObject, x.RoomName });
                    table.ForeignKey(
                        name: "FK_CRDTs_Rooms_RoomName",
                        column: x => x.RoomName,
                        principalTable: "Rooms",
                        principalColumn: "Name",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CRDTs_RoomName",
                table: "CRDTs",
                column: "RoomName",
                unique: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CRDTs");

            migrationBuilder.DropTable(
                name: "Rooms");
        }
    }
}
