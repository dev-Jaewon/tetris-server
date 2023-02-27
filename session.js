class Session {
    constructor(id) {
        this.id = id;
        this.users = new Set();
    }

    join(client) {
        this.users.add(client);
        client.session = this;

        return this;
    }

    leave(client) {
        this.users.delete(client);
        client.session = null;

        return this;
    }
}

module.exports = Session;
