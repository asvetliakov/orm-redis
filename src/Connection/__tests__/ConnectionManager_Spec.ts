jest.mock("../Connection");
import { ShouldThrowError } from "../../testutils/ShouldThrowError";
import { Connection } from "../Connection";
import { ConnectionManager } from "../ConnectionManager";

let manager: ConnectionManager;

beforeEach(() => {
    manager = new ConnectionManager();
});

describe("createConnection", () => {
    it("Creates default connection", async () => {
        const conn = await manager.createConnection({ host: "test" });
        expect(conn).toBeInstanceOf(Connection);
        expect(manager.getConnection("default")).toBe(conn);
        expect(conn.connect).toBeCalled();
    });

    it("Creates named connection", async () => {
        const conn = await manager.createConnection({ host: "test" }, "testconn");
        expect(conn).toBeInstanceOf(Connection);
        expect(manager.getConnection("testconn")).toBe(conn);
        expect(conn.connect).toBeCalled();
    });

    it("Throws if there is already such connection", async () => {
        await manager.createConnection({ host: "" }, "testconn");
        try {
            await manager.createConnection({ host: "" }, "testconn");
            throw new ShouldThrowError();
        } catch (e) {
            if (e instanceof ShouldThrowError) { throw e; }
        }
    });    
});

describe("Remove connection", () => {
    it("Removes connection from manager", async () => {
        await manager.createConnection({ host: "" });
        await manager.createConnection({ host: "" }, "testconn");
        await manager.removeConnection();
        await manager.removeConnection("testconn");
        expect(manager.getConnection()).toBeUndefined();
        expect(manager.getConnection("testconn")).toBeUndefined();
    });

    it("Disconnects connection when requested", async () => {
        const conn = await manager.createConnection({ host: "" }, "testconn");
        const conn2 = await manager.createConnection({ host: "" });
        await manager.removeConnection("testconn", false);
        await manager.removeConnection("default", true);
        expect(conn.disconnect).not.toBeCalled();
        expect(conn2.disconnect).toBeCalled();
    });
});