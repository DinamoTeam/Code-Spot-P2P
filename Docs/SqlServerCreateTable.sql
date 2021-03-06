CREATE TABLE rooms (
	RoomName VARCHAR(128) PRIMARY KEY
);

CREATE TABLE peers (
    Id int IDENTITY(1,1) PRIMARY KEY,
	PeerId VARCHAR(128) NOT NULL,
	RoomName VARCHAR(128) NOT NULL,
	HasReceivedAllMessages int NOT NULL,
	CursorColor int NOT NULL,
	FOREIGN KEY (RoomName) REFERENCES rooms(RoomName)
);