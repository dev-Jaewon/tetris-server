const express = require("express");
const expressSession = require("express-session");
const app = express();
app.set("port", 9000);

app.use(
    expressSession({
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: true,
        },
    })
);

const appServer = app.listen(app.get("port"), () => {
    console.log(app.get("port"), "번 포트에서 대기 중");
});

const Session = require("./session");
const User = require("./user");
const Ws = require("ws").Server;
const crypto = require("crypto");

const server = new Ws({ server: appServer });

// ({ port: 9000 }, () => {
//     console.log("서버 연결 완료");
// });

const sessions = {};

const createId = () => {
    return crypto.randomBytes(6).toString("base64");
};

const createSession = (id) => {
    const session = new Session(id);

    sessions[session.id] = session;
    return session;
};

server.on("connection", (conn) => {
    const newUser = new User(conn, createId());

    console.log(newUser.id + "접속하셨습니다.");

    conn.on("message", (msg) => {
        const { type, session, render, isReady, isPlaying, gameResult } =
            JSON.parse(msg);

        if (type === "create-session") {
            if (newUser.session) {
                const session = newUser.session;
                newUser.session.leave(newUser);
                if (session.users.size === 0) {
                    delete sessions[session.id];
                } else {
                    session.users.forEach((user) =>
                        user.conn.send(
                            JSON.stringify({
                                type: "out-session",
                                id: newUser.id,
                            })
                        )
                    );
                }
            }

            const newSession = createSession(createId());
            newSession.join(newUser);

            newUser.send({
                type: "create-session",
                session: newSession.id,
                id: newUser.id,
            });
        }

        if (type === "join-session") {
            let setSession = null;

            if (!sessions[session]) {
                setSession = createSession(session);
            } else if (sessions[session]?.users.size >= 2) {
                setSession = createSession(createId());
            } else {
                setSession = sessions[session];
            }

            setSession.join(newUser);

            const users = [...newUser.session.users]
                .filter((user) => user.id !== newUser.id)
                .map(({ isReady, isPlaying, id }) => ({
                    isReady,
                    isPlaying,
                    id,
                    gameResult,
                }));

            newUser.send({
                type: "join-session",
                data: users,
                id: newUser.id,
                session: setSession.id,
            });

            newUser.sendAll({
                type: "join-session",
                data: [
                    {
                        id: newUser.id,
                        isPlaying: "stop",
                        isReady: false,
                        gameResult,
                    },
                ],
            });
        }

        if (type === "random-session") {
            let session = newUser.session;
            newUser.session.leave(newUser);

            if (session.users.size === 0) {
                delete sessions[session.id];
            } else {
                session.users.forEach((user) =>
                    user.conn.send(
                        JSON.stringify({
                            type: "out-session",
                            id: newUser.id,
                        })
                    )
                );
            }

            if (Object.keys(sessions).length === 0) {
                session = createSession(createId());
                session.join(newUser);

                newUser.send({
                    type: "create-session",
                    session: session.id,
                    id: newUser.id,
                });
            } else {
                Object.keys(sessions).some((session, i) => {
                    if (sessions[session].users.size < 2) {
                        sessions[session].join(newUser);

                        const users = [...newUser.session.users]
                            .filter((user) => user.id !== newUser.id)
                            .map(({ isReady, isPlaying, id }) => ({
                                isReady,
                                isPlaying,
                                id,
                                gameResult,
                            }));

                        newUser.send({
                            type: "random-session",
                            data: users,
                            id: newUser.id,
                            session: newUser.session.id,
                        });

                        newUser.sendAll({
                            type: "join-session",
                            data: [
                                {
                                    id: newUser.id,
                                    isPlaying: "stop",
                                    isReady: false,
                                    gameResult,
                                    session: session,
                                },
                            ],
                        });
                        return true;
                    }
                });
            }
        }

        if (type === "update-session") {
            newUser.sendAll({
                type: "update-session",
                data: [
                    {
                        id: newUser.id,
                        render,
                        isReady,
                        isPlaying,
                        gameResult,
                    },
                ],
            });
        }
    });

    conn.on("close", () => {
        const session = newUser.session.leave(newUser);

        if (session.users.size === 0) {
            delete sessions[session.id];
        } else {
            session.users.forEach((user) =>
                user.conn.send(
                    JSON.stringify({
                        type: "out-session",
                        id: newUser.id,
                    })
                )
            );
        }
    });
});
