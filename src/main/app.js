const express = require('express')
const socketio = require('socket.io')
const http = require('http')
const app = express()
const server = http.createServer(app)
const io = socketio(server)
const UserModel = require('./models/entity/users/user')
require('./models/mongoose')

const controllersFolderPath = './controllers'

const routers = [
    'userController',
    'chatController',
    'groupController',
    'postController'
]

const onConnection = function (socket) {
    const authToken = socket.handshake.headers.authorization
    if (authToken) {
        const userId = UserModel.getUserIdFromAuthToken(authToken.replace('bearer ', ''))
        //console.log(`'New WebSocket connection, joined : userId[${userId}], socketId[${socket.id}]`)
        socket.join(userId)
    }

    socket.on("disconnecting", (reason) => {
        //console.log("Disconnected ", reason)
    });
}
io.on("connection", onConnection);


app.use(express.json())
routers.forEach(controllerPath => {
    app.use(require(`${controllersFolderPath}/${controllerPath}`)(io))
});

module.exports = server