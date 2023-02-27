class User {
    constructor(conn, id) {
        this.conn = conn;
        this.id = id;
        this.render = [];
        this.isReady = false;
        this.isPlaying = "stop";
        this.session = null;
    }

    send(data) {
        this.conn.send(JSON.stringify(data));
    }

    sendAll(msg) {
        [...this.session.users]
            .filter((user) => user.id !== this.id)
            .forEach((user) => user.conn.send(JSON.stringify(msg)));
    }
}

module.exports = User;
