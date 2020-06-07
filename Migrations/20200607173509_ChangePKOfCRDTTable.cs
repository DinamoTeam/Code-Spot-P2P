using Microsoft.EntityFrameworkCore.Migrations;

namespace CodeSpot.Migrations
{
    public partial class ChangePKOfCRDTTable : Migration
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
                    Id = table.Column<int>(nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CRDTObject = table.Column<string>(nullable: false),
                    RoomName = table.Column<string>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CRDTs", x => x.Id);
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
